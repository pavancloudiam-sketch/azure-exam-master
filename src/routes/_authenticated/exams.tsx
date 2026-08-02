import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, FileQuestion, Target, Timer } from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SecondaryButton,
  SelectField,
  StatusBadge,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { listPublishedExams } from "@/features/exams/services/exam-service";
import {
  ATTEMPT_MODE_DESCRIPTIONS,
  ATTEMPT_MODE_LABELS,
  ATTEMPT_MODE_RULES,
  SELECTABLE_ATTEMPT_MODES,
  isTimedMode,
  type AttemptMode,
  type Exam,
} from "@/features/exams/types";
import { requestExamReminder } from "@/features/billing/services/billing-service";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Practice exams — AskMeExam" },
      {
        name: "description",
        content: "Start a realistic mock, practice, skill-area or revision Microsoft Entra ID exam session.",
      },
      { property: "og:title", content: "Practice exams — AskMeExam" },
      { property: "og:description", content: "Choose a realistic mock, practice, skill-area or revision session." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamsPage,
});

/** One selectable mode inside an exam card. Links to the instruction gate. */
function ModeChoice({ exam, mode }: { exam: Exam; mode: AttemptMode }) {
  const rules = ATTEMPT_MODE_RULES[mode];
  const timed = isTimedMode(mode);
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{ATTEMPT_MODE_LABELS[mode]}</h3>
        <StatusBadge tone={timed ? "warning" : "neutral"}>
          {timed ? (
            <>
              <Timer className="mr-1 size-3" aria-hidden="true" /> Timed
            </>
          ) : (
            "Untimed"
          )}
        </StatusBadge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{ATTEMPT_MODE_DESCRIPTIONS[mode]}</p>
      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt className="min-w-24 font-medium text-foreground">Timer</dt>
          <dd>{rules.timer}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="min-w-24 font-medium text-foreground">Questions</dt>
          <dd>{rules.questions}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="min-w-24 font-medium text-foreground">Explanations</dt>
          <dd>{rules.explanations}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="min-w-24 font-medium text-foreground">Repeats</dt>
          <dd>{rules.repeats}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="min-w-24 font-medium text-foreground">Skill areas</dt>
          <dd>{rules.domainFilter}</dd>
        </div>
      </dl>
      <Link
        to="/exams/$examId/start"
        params={{ examId: exam.id }}
        search={{ mode }}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Review instructions
      </Link>
    </li>
  );
}

function ExamsPage() {
  const [reminding, setReminding] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [mode, setMode] = React.useState("all");

  const { data: exams, error, isLoading } = useQuery({
    queryKey: ["published-exams"],
    queryFn: listPublishedExams,
    staleTime: 60_000,
  });

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
      description="Pick an exam, then choose how you want to sit it. Every mode uses the same question bank; only the timing, length and question selection change. Answers and explanations stay hidden until you submit."
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
          <div className="space-y-6">
            {visible.map((exam) => (
              <article
                key={exam.id}
                className="rounded-xl border border-border bg-card p-6 shadow-card"
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
                    <dd>Pass at {exam.passing_score}</dd>
                  </div>
                </dl>

                <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Choose a mode
                </h3>
                <ul className="mt-3 grid gap-4 md:grid-cols-2">
                  {SELECTABLE_ATTEMPT_MODES.map((selectable) => (
                    <ModeChoice key={selectable} exam={exam} mode={selectable} />
                  ))}
                </ul>

                <div className="mt-5">
                  <SecondaryButton onClick={() => void remindMe(exam)} loading={reminding === exam.id}>
                    <Bell aria-hidden="true" /> Remind me tomorrow
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
