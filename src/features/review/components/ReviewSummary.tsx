import { SurfaceCard, StatusBadge } from "@/features/shared/components/ui";
import type { AttemptResult } from "@/features/results/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Compact header for the review screen; the full breakdown stays on results. */
export function ReviewSummary({ result }: { result: AttemptResult }) {
  const attemptDate = new Date(result.submitted_at);
  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{result.exam_title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {attemptDate.toLocaleDateString()} at{" "}
            {attemptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <StatusBadge tone={result.passed ? "success" : "error"}>
          {result.passed ? "Pass" : "Fail"}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Scaled score" value={`${result.scaled_score}/1000`} />
        <Stat label="Percentage" value={`${result.percentage.toFixed(1)}%`} />
        <Stat label="Questions" value={String(result.total_questions)} />
        <Stat label="Correct" value={String(result.correct_count)} />
        <Stat label="Incorrect" value={String(result.incorrect_count)} />
        <Stat label="Unanswered" value={String(result.unanswered_count)} />
      </dl>
    </SurfaceCard>
  );
}