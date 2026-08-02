import { CheckCircle2, XCircle } from "lucide-react";

import { StatusBadge, SurfaceCard } from "@/features/shared/components/ui";
import { cn } from "@/lib/utils";
import { formatDuration, type AttemptResult } from "../types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ResultSummary({ result }: { result: AttemptResult }) {
  const attemptDate = new Date(result.submitted_at);

  return (
    <div className="space-y-8">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{result.exam_title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Attempted {attemptDate.toLocaleDateString()} at{" "}
              {attemptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
              {result.mode === "timed" ? "Timed mode" : "Practice mode"}
            </p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-lg font-semibold",
              result.passed
                ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700"
                : "border-destructive/40 bg-destructive/10 text-destructive-ink",
            )}
          >
            {result.passed ? (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            ) : (
              <XCircle className="size-5" aria-hidden="true" />
            )}
            {result.passed ? "Pass" : "Fail"}
          </div>
        </div>
      </SurfaceCard>

      <section aria-labelledby="score-heading">
        <h2 id="score-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Score
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Scaled score"
            value={`${result.scaled_score} / 1000`}
            hint={`Passing score ${result.passing_score}`}
          />
          <Stat label="Percentage" value={`${result.percentage.toFixed(2)}%`} />
          <Stat
            label="Raw score"
            value={`${result.raw_score} / ${result.max_score}`}
            hint="Points earned"
          />
          <Stat label="Time taken" value={formatDuration(result.duration_seconds)} />
        </div>
      </section>

      <section aria-labelledby="questions-heading">
        <h2 id="questions-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Questions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total questions" value={String(result.total_questions)} />
          <Stat label="Correct" value={String(result.correct_count)} />
          <Stat label="Incorrect" value={String(result.incorrect_count)} />
          <Stat label="Unanswered" value={String(result.unanswered_count)} />
        </div>
      </section>

      <section aria-labelledby="domains-heading">
        <h2 id="domains-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Performance by domain
        </h2>
        {result.domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">No domain data for this attempt.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Questions, correct answers and percentage per domain</caption>
              <thead className="bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Domain</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Questions</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Correct</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {result.domains.map((domain) => (
                  <tr key={domain.name} className="border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left font-normal">{domain.name}</th>
                    <td className="px-4 py-3 text-right tabular-nums">{domain.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{domain.correct}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <StatusBadge tone={domain.percentage >= 70 ? "success" : "warning"}>
                        {Number(domain.percentage).toFixed(1)}%
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Scaled scoring on AskMeExam is our own 0–1000 model for practice feedback. It is not
        Microsoft's official scoring method and does not predict an official exam outcome.
      </p>
    </div>
  );
}