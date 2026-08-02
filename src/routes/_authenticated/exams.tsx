import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, FileQuestion, PlayCircle, Target } from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusBadge,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { listPublishedExams } from "@/features/exams/services/exam-service";
import type { AttemptMode, Exam } from "@/features/exams/types";
import { startAttempt } from "@/features/attempts/services/attempt-service";
import { requestExamReminder } from "@/features/billing/services/billing-service";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Practice exams — AskMeExam" },
      {
        name: "description",
        content: "Start a timed or practice Microsoft Entra ID exam session.",
      },
      { property: "og:title", content: "Practice exams — AskMeExam" },
      { property: "og:description", content: "Start a timed or practice exam session." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const [starting, setStarting] = React.useState<string | null>(null);
  const [reminding, setReminding] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [mode, setMode] = React.useState("all");
  const navigate = useNavigate();

  const { data: exams, error, isLoading } = useQuery({
    queryKey: ["published-exams"],
    queryFn: listPublishedExams,
    staleTime: 60_000,
  });

  async function begin(exam: Exam, attemptMode: AttemptMode) {
    setStarting(`${exam.id}-${attemptMode}`);
    try {
      const attempt = await startAttempt(exam, attemptMode);
      void navigate({ to: "/attempt/$attemptId", params: { attemptId: attempt.id } });
    } catch (cause) {
      notify.error(cause instanceof Error ? cause.message : "Could not start the exam.");
      setStarting(null);
    }
  }

  /** Queues a study reminder for tomorrow; repeats are de-duplicated server-side. */
  async function remindMe(exam: Exam) {
    setReminding(exam.id);
    try {
      const when = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await requestExamReminder(exam.id, when);
      notify.success("Reminder scheduled", `We'll remind you about ${exam.title} tomorrow.`);
    } catch (cause) {
      notify.error(cause instanceof Error ? cause.message : "Could not schedule the reminder.");
    } finally {
      setReminding(null);
    }
  }

  const visible = (exams ?? []).filter((exam) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term === "" ||
      exam.title.toLowerCase().includes(term) ||
      (exam.description ?? "").toLowerCase().includes(term);
    const matchesMode =
      mode === "all" ||
      (mode === "timed" && Boolean(exam.time_limit_minutes)) ||
      (mode === "practice" && exam.allow_practice);
    return matchesSearch && matchesMode;
  });

  return (
    <PageShell
      title="Practice exams"
      description="Choose timed mode to work against the clock, or practice mode for an untimed run. Answers and explanations stay hidden until you submit."
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextField
          id="exam-search"
          label="Search exams"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Exam title or description"
        />
        <SelectField
          id="exam-mode"
          label="Available mode"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "all", label: "All exams" },
            { value: "timed", label: "Timed available" },
            { value: "practice", label: "Practice available" },
          ]}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorState
            title="Exams unavailable"
            description={error instanceof Error ? error.message : "Could not load exams."}
          />
        ) : isLoading ? (
          <LoadingBlock label="Loading exams" />
        ) : visible.length === 0 ? (
          <EmptyState
            title={exams?.length ? "No exams match your filters" : "No published exams yet"}
            description={
              exams?.length
                ? "Try a different search term or clear the mode filter."
                : "Published exams will appear here as soon as an administrator releases one."
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((exam) => (
              <article
                key={exam.id}
                className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-card"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{exam.title}</h2>
                    {exam.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{exam.description}</p>
                    ) : null}
                  </div>
                  {exam.time_limit_minutes ? (
                    <StatusBadge tone="info" className="shrink-0">
                      <Clock className="mr-1 size-3" aria-hidden="true" />
                      {exam.time_limit_minutes} min
                    </StatusBadge>
                  ) : null}
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileQuestion className="size-4" aria-hidden="true" />
                    <dt className="sr-only">Questions</dt>
                    <dd>{exam.question_count} questions</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="size-4" aria-hidden="true" />
                    <dt className="sr-only">Passing score</dt>
                    <dd>Pass at {exam.passing_score}%</dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap gap-3 pt-6">
                  <PrimaryButton
                    onClick={() => void begin(exam, "timed")}
                    loading={starting === `${exam.id}-timed`}
                    disabled={!exam.time_limit_minutes}
                    title={
                      exam.time_limit_minutes ? undefined : "This exam has no time limit configured"
                    }
                  >
                    <PlayCircle aria-hidden="true" /> Start timed
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={() => void begin(exam, "practice")}
                    loading={starting === `${exam.id}-practice`}
                  >
                    Start practice
                  </SecondaryButton>
                  <SecondaryButton onClick={() => void remindMe(exam)} loading={reminding === exam.id}>
                    <Bell aria-hidden="true" /> Remind me
                  </SecondaryButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
