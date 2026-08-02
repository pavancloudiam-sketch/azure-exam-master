import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SelectField,
  StatusBadge,
  TextField,
} from "@/features/shared/components/ui";
import { listMyAttemptsDetailed } from "@/features/attempts/services/attempt-service";
import type { AttemptWithExam } from "@/features/attempts/types";

export const Route = createFileRoute("/_authenticated/attempts")({
  head: () => ({
    meta: [
      { title: "My attempts — AskMeExam" },
      { name: "description", content: "Every practice exam attempt you have taken." },
      { property: "og:title", content: "My attempts — AskMeExam" },
      { property: "og:description", content: "Your full practice exam attempt history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttemptsPage,
});

function score(attempt: AttemptWithExam) {
  const value = attempt.scaled_score ?? attempt.percentage;
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

function AttemptsPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-attempts-detailed"],
    queryFn: () => listMyAttemptsDetailed(200),
    staleTime: 30_000,
  });

  const rows = (data ?? []).filter((attempt) => {
    const title = attempt.exams?.title ?? "";
    const matchesSearch = title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus =
      status === "all" ||
      (status === "in_progress" && attempt.status === "in_progress") ||
      (status === "passed" && attempt.passed === true) ||
      (status === "failed" && attempt.passed === false);
    return matchesSearch && matchesStatus;
  });

  return (
    <PageShell
      title="My attempts"
      description="Every attempt you have started, with its score and a link to the full review."
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextField
          label="Search by exam"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Exam title"
        />
        <SelectField
          label="Status"
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "all", label: "All attempts" },
            { value: "in_progress", label: "In progress" },
            { value: "passed", label: "Passed" },
            { value: "failed", label: "Not passed" },
          ]}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorState
            title="Attempts unavailable"
            description={error instanceof Error ? error.message : "Could not load your attempts."}
          />
        ) : isLoading ? (
          <LoadingBlock label="Loading attempts" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No attempts found"
            description="Adjust the filters, or start a new practice exam from the catalogue."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {rows.map((attempt) => (
              <li key={attempt.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {attempt.exams?.title ?? "Practice exam"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Started {new Date(attempt.started_at).toLocaleString()} · {attempt.mode} mode
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    tone={
                      attempt.status === "in_progress"
                        ? "warning"
                        : attempt.passed === true
                          ? "success"
                          : attempt.passed === false
                            ? "error"
                            : "neutral"
                    }
                  >
                    {attempt.status === "in_progress"
                      ? "In progress"
                      : attempt.passed === true
                        ? "Passed"
                        : attempt.passed === false
                          ? "Not passed"
                          : attempt.status.replace(/_/g, " ")}
                  </StatusBadge>
                  <span className="text-sm font-semibold tabular-nums">{score(attempt)}</span>
                  {attempt.status === "in_progress" ? (
                    <Link
                      to="/attempt/$attemptId"
                      params={{ attemptId: attempt.id }}
                      className="text-sm font-medium text-accent-ink hover:underline"
                    >
                      Resume
                    </Link>
                  ) : (
                    <>
                      <Link
                        to="/results/$attemptId"
                        params={{ attemptId: attempt.id }}
                        className="text-sm font-medium text-accent-ink hover:underline"
                      >
                        Result
                      </Link>
                      <Link
                        to="/review/$attemptId"
                        params={{ attemptId: attempt.id }}
                        className="text-sm font-medium text-accent-ink hover:underline"
                      >
                        Review
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
