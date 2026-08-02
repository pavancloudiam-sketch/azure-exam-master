import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { getAttemptReview } from "../services/review-service";
import type { ReviewFilter, ReviewQuestion } from "../types";

function matches(question: ReviewQuestion, filter: ReviewFilter): boolean {
  if (filter === "all") return true;
  if (filter === "marked") return question.marked_for_review;
  return question.status === filter;
}

/**
 * Loads the review payload for a submitted attempt and owns the local
 * navigation state (filter + current position). No answer key is ever fetched
 * before the database has authorized the caller.
 */
export function useAttemptReview(attemptId: string) {
  const query = useQuery({
    queryKey: ["attempt-review", attemptId],
    queryFn: () => getAttemptReview(attemptId),
  });

  const [filter, setFilter] = React.useState<ReviewFilter>("all");
  const [index, setIndex] = React.useState(0);

  const questions = React.useMemo(() => query.data ?? [], [query.data]);

  const visible = React.useMemo(
    () => questions.filter((question) => matches(question, filter)),
    [questions, filter],
  );

  // Keep the cursor inside the filtered list when the filter changes.
  React.useEffect(() => {
    setIndex(0);
  }, [filter]);

  const safeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1);
  const current = visible[safeIndex] ?? null;

  const counts = React.useMemo(
    () => ({
      all: questions.length,
      correct: questions.filter((q) => q.status === "correct").length,
      incorrect: questions.filter((q) => q.status === "incorrect").length,
      unanswered: questions.filter((q) => q.status === "unanswered").length,
      marked: questions.filter((q) => q.marked_for_review).length,
    }),
    [questions],
  );

  return {
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    questions,
    visible,
    counts,
    filter,
    setFilter,
    index: safeIndex,
    setIndex,
    current,
    /** Position of the current question in the full attempt, 1-based. */
    questionNumber: current ? questions.findIndex((q) => q.question_id === current.question_id) + 1 : 0,
    goPrevious: () => setIndex((value) => Math.max(0, value - 1)),
    goNext: () => setIndex((value) => Math.min(visible.length - 1, value + 1)),
  };
}