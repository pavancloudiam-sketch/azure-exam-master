import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, PlayCircle } from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
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
  const navigate = useNavigate();

  // Cached and de-duplicated; the previous effect issued the same read twice.
  const { data: exams, error } = useQuery({
    queryKey: ["published-exams"],
    queryFn: listPublishedExams,
    staleTime: 60_000,
  });

  async function begin(exam: Exam, mode: AttemptMode) {
    setStarting(`${exam.id}-${mode}`);
    try {
      const attempt = await startAttempt(exam, mode);
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

  return (
    <PageShell
      title="Practice exams"
      description="Choose timed mode to work against the clock, or practice mode for an untimed run. Answers and explanations stay hidden until you submit."
    >
      {error ? (
        <ErrorState
          title="Exams unavailable"
          description={error instanceof Error ? error.message : "Could not load exams."}
        />
      ) : null}
      {!error && !exams ? <LoadingBlock label="Loading exams" /> : null}
      {exams?.length === 0 ? (
        <EmptyState
          title="No published exams yet"
          description="Published exams will appear here as soon as an administrator releases one."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {exams?.map((exam) => (
          <SurfaceCard key={exam.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{exam.title}</h2>
                {exam.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{exam.description}</p>
                ) : null}
              </div>
              {exam.time_limit_minutes ? (
                <StatusBadge tone="info">
                  <Clock className="mr-1 size-3" aria-hidden="true" />
                  {exam.time_limit_minutes} min
                </StatusBadge>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
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
              <SecondaryButton
                onClick={() => void remindMe(exam)}
                loading={reminding === exam.id}
              >
                <Bell aria-hidden="true" /> Remind me tomorrow
              </SecondaryButton>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PageShell>
  );
}