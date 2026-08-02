import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SecondaryButton,
  StatusAlert,
} from "@/features/shared/components/ui";
import {
  ReviewFilters,
  ReviewPalette,
  ReviewQuestionCard,
  ReviewSummary,
} from "@/features/review/components";
import { useAttemptReview } from "@/features/review/hooks";
import { getAttemptResult } from "@/features/results/services/result-service";

export const Route = createFileRoute("/_authenticated/review/$attemptId")({
  head: () => ({
    meta: [
      { title: "Review answers — AskMeExam" },
      {
        name: "description",
        content:
          "Review each question of a submitted AskMeExam attempt with your answer, the correct answer and the explanation.",
      },
      { property: "og:title", content: "Review answers — AskMeExam" },
      {
        property: "og:description",
        content: "Question-by-question review of a submitted practice attempt.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { attemptId } = Route.useParams();
  const review = useAttemptReview(attemptId);
  const result = useQuery({
    queryKey: ["attempt-result", attemptId],
    queryFn: () => getAttemptResult(attemptId),
  });

  const numbers = review.visible.map(
    (question) =>
      review.questions.findIndex((row) => row.question_id === question.question_id) + 1,
  );

  return (
    <PageShell
      title="Review answers"
      description="Your answers, the correct answers and the explanation for each question of this submitted attempt."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="shadow-none">
            <Link to="/results/$attemptId" params={{ attemptId }}>
              Back to results
            </Link>
          </Button>
          <Button asChild variant="outline" className="shadow-none">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        {review.loading || result.isLoading ? <LoadingBlock label="Loading your review" /> : null}

        {review.error ? (
          <ErrorState
            title="Review unavailable"
            description={review.error.message}
            onRetry={() => void review.refetch()}
          />
        ) : null}

        {!review.loading && !review.error && review.questions.length === 0 ? (
          <StatusAlert tone="info" title="No review available for this attempt">
            Only attempts you have submitted yourself can be reviewed. Attempts that are still in
            progress, cancelled, or that belong to another account are never shown.
          </StatusAlert>
        ) : null}

        {review.questions.length > 0 ? (
          <>
            {result.data ? <ReviewSummary result={result.data} /> : null}

            <ReviewFilters
              value={review.filter}
              counts={review.counts}
              onChange={review.setFilter}
            />

            <p aria-live="polite" className="text-sm text-muted-foreground">
              {review.visible.length === 0
                ? "No questions match this filter."
                : `Showing question ${review.index + 1} of ${review.visible.length} in this filter.`}
            </p>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-4">
                {review.current ? (
                  <ReviewQuestionCard
                    question={review.current}
                    number={review.questionNumber}
                    total={review.questions.length}
                  />
                ) : (
                  <EmptyState
                    title="Nothing to show"
                    description="No questions in this attempt match the selected filter."
                  />
                )}

                <div className="flex justify-between gap-2">
                  <SecondaryButton onClick={review.goPrevious} disabled={review.index === 0}>
                    Previous question
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={review.goNext}
                    disabled={review.index >= review.visible.length - 1}
                  >
                    Next question
                  </SecondaryButton>
                </div>
              </div>

              <aside aria-label="Question navigation panel" className="lg:pt-1">
                <ReviewPalette
                  questions={review.visible}
                  numbers={numbers}
                  currentIndex={review.index}
                  onJump={review.setIndex}
                />
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}