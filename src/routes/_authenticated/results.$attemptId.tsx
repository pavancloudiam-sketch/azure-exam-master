import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock, StatusAlert } from "@/features/shared/components/ui";
import { ResultSummary } from "@/features/results/components/ResultSummary";
import { AiCoachPanel } from "@/features/ai/components/AiCoachPanel";
import { getAttemptResult } from "@/features/results/services/result-service";
import { notifyResultAvailable } from "@/features/billing/services/billing-service";
import type { AttemptResult } from "@/features/results/types";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Exam result — AskMeExam" },
      { name: "description", content: "Your score, pass status and domain breakdown for this attempt." },
      { property: "og:title", content: "Exam result — AskMeExam" },
      { property: "og:description", content: "Score, pass status and domain breakdown." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const { attemptId } = Route.useParams();
  const [result, setResult] = React.useState<AttemptResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    getAttemptResult(attemptId)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load the result.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  // Queue the "result available" message once the result loads. The routine is
  // idempotent per attempt, so revisiting this page never sends a duplicate.
  React.useEffect(() => {
    if (!result) return;
    void notifyResultAvailable(attemptId).catch(() => {
      /* messaging must never block the result view */
    });
  }, [result, attemptId]);

  return (
    <PageShell title="Exam result" description="Your performance for this attempt.">
      {loading ? <LoadingBlock label="Loading your result" /> : null}
      {!loading && error ? <ErrorState title="Result unavailable" description={error} /> : null}
      {!loading && !error && !result ? (
        <StatusAlert tone="info" title="No result for this attempt">
          Only submitted attempts have results. An attempt that is still in progress or was
          cancelled is never scored.{" "}
          <Link to="/dashboard" className="underline">
            Back to dashboard
          </Link>
        </StatusAlert>
      ) : null}
      {result ? (
        <div className="mb-6">
          <Button asChild className="shadow-none">
            <Link to="/review/$attemptId" params={{ attemptId }}>
              Review answers
            </Link>
          </Button>
        </div>
      ) : null}
      {result ? <ResultSummary result={result} /> : null}
      {result ? <AiCoachPanel attemptId={attemptId} /> : null}
    </PageShell>
  );
}