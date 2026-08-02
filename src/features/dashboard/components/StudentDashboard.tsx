import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  GraduationCap,
  History,
  Play,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  StatCard,
  StatusBadge,
  SurfaceCard,
} from "@/features/shared/components/ui";
import { listMyAttemptsDetailed } from "@/features/attempts/services/attempt-service";
import { listPublishedExams } from "@/features/exams/services/exam-service";
import type { AttemptWithExam } from "@/features/attempts/types";

function scoreOf(attempt: AttemptWithExam) {
  return attempt.scaled_score ?? attempt.percentage ?? null;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
}

function statusTone(attempt: AttemptWithExam) {
  if (attempt.status === "in_progress") return "warning" as const;
  if (attempt.passed === true) return "success" as const;
  if (attempt.passed === false) return "error" as const;
  return "neutral" as const;
}

function statusLabel(attempt: AttemptWithExam) {
  if (attempt.status === "in_progress") return "In progress";
  if (attempt.passed === true) return "Passed";
  if (attempt.passed === false) return "Not passed";
  return attempt.status.replace(/_/g, " ");
}

/** Personalised student home: progress at a glance, then the next action. */
export function StudentDashboard() {
  const attempts = useQuery({
    queryKey: ["my-attempts-detailed"],
    queryFn: () => listMyAttemptsDetailed(50),
    staleTime: 30_000,
  });
  const exams = useQuery({
    queryKey: ["published-exams"],
    queryFn: listPublishedExams,
    staleTime: 60_000,
  });

  if (attempts.isError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        description={
          attempts.error instanceof Error ? attempts.error.message : "Could not load your progress."
        }
      />
    );
  }
  if (attempts.isLoading) return <LoadingBlock label="Loading your progress" />;

  const rows = attempts.data ?? [];
  const finished = rows.filter((a) => a.status !== "in_progress" && scoreOf(a) !== null);
  const inProgress = rows.find((a) => a.status === "in_progress");
  const averageScore = finished.length
    ? Math.round(finished.reduce((sum, a) => sum + (scoreOf(a) ?? 0), 0) / finished.length)
    : null;
  const passRate = finished.length
    ? Math.round((finished.filter((a) => a.passed === true).length / finished.length) * 100)
    : null;
  const best = finished.reduce<number | null>(
    (max, a) => Math.max(max ?? 0, scoreOf(a) ?? 0),
    null,
  );

  return (
    <div className="space-y-8">
      <section aria-label="Progress summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Exams completed"
          value={finished.length}
          hint={inProgress ? "1 attempt still open" : "All attempts submitted"}
          icon={CheckCircle2}
        />
        <StatCard
          label="Average score"
          value={averageScore === null ? "—" : `${averageScore}%`}
          hint="Across all submitted attempts"
          icon={TrendingUp}
        />
        <StatCard
          label="Pass rate"
          value={passRate === null ? "—" : `${passRate}%`}
          hint="Attempts meeting the passing score"
          icon={Target}
        />
        <StatCard
          label="Best score"
          value={best === null ? "—" : `${Math.round(best)}%`}
          hint="Your strongest result so far"
          icon={GraduationCap}
        />
      </section>

      {inProgress ? (
        <SurfaceCard
          title="Continue where you left off"
          description={inProgress.exams?.title ?? "Practice exam"}
          actions={
            <Link
              to="/attempt/$attemptId"
              params={{ attemptId: inProgress.id }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="size-4" aria-hidden="true" /> Resume attempt
            </Link>
          }
        >
          <p className="text-sm text-muted-foreground">
            Started {formatDate(inProgress.started_at)} in {inProgress.mode} mode. Your answers were
            saved automatically.
          </p>
        </SurfaceCard>
      ) : null}

      <section aria-labelledby="recent-attempts" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recent-attempts" className="text-lg font-semibold">
            Recent attempts
          </h2>
          <Link
            to="/attempts"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
          >
            View all <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="No attempts yet"
            description="Start your first practice exam to begin tracking your progress."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {rows.slice(0, 5).map((attempt) => (
              <li
                key={attempt.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {attempt.exams?.title ?? "Practice exam"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(attempt.submitted_at ?? attempt.started_at)} · {attempt.mode}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge tone={statusTone(attempt)}>{statusLabel(attempt)}</StatusBadge>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums">
                    {scoreOf(attempt) === null ? "—" : `${Math.round(scoreOf(attempt) as number)}%`}
                  </span>
                  <Link
                    to={attempt.status === "in_progress" ? "/attempt/$attemptId" : "/results/$attemptId"}
                    params={{ attemptId: attempt.id }}
                    className="text-sm font-medium text-accent-ink hover:underline"
                  >
                    {attempt.status === "in_progress" ? "Resume" : "Result"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recommended" className="space-y-3">
        <h2 id="recommended" className="text-lg font-semibold">
          Ready to practise
        </h2>
        {exams.data && exams.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {exams.data.slice(0, 4).map((exam) => (
              <SurfaceCard key={exam.id} title={exam.title} description={exam.description ?? undefined}>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone="info">
                    <FileQuestion className="mr-1 size-3" aria-hidden="true" />
                    {exam.question_count} questions
                  </StatusBadge>
                  {exam.time_limit_minutes ? (
                    <StatusBadge>{exam.time_limit_minutes} min</StatusBadge>
                  ) : null}
                  <Link to="/exams" className="ml-auto">
                    <PrimaryButton size="sm">Open catalogue</PrimaryButton>
                  </Link>
                </div>
              </SurfaceCard>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No published exams yet"
            description="Exams appear here as soon as an administrator publishes one."
          />
        )}
      </section>

      <section aria-labelledby="quick-links" className="space-y-3">
        <h2 id="quick-links" className="text-lg font-semibold">
          Quick links
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { to: "/study", label: "Study Assistant", copy: "Get a plan for your weak domains.", icon: GraduationCap },
            { to: "/attempts", label: "My attempts", copy: "Review every past attempt.", icon: History },
            { to: "/resources", label: "Resources", copy: "Study material shared with you.", icon: FileQuestion },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-accent"
            >
              <link.icon className="size-5 text-accent-ink" aria-hidden="true" />
              <p className="mt-3 font-medium">{link.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{link.copy}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
