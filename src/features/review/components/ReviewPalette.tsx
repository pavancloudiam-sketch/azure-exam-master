import { cn } from "@/lib/utils";
import { REVIEW_STATUS_LABELS, type ReviewQuestion } from "../types";

const statusStyles: Record<string, string> = {
  correct: "border-success/40 bg-success/10 text-foreground",
  incorrect: "border-destructive/50 bg-destructive/10 text-foreground",
  unanswered: "border-border bg-background text-muted-foreground",
};

/**
 * Question navigation for the review screen. Status is conveyed by the letter
 * badge and the accessible name, never by colour alone.
 */
export function ReviewPalette({
  questions,
  numbers,
  currentIndex,
  onJump,
}: {
  questions: ReviewQuestion[];
  numbers: number[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Review question navigation">
      <ul className="grid grid-cols-8 gap-2 lg:grid-cols-6">
        {questions.map((question, position) => {
          const isCurrent = position === currentIndex;
          const statusLabel = REVIEW_STATUS_LABELS[question.status];
          return (
            <li key={question.question_id}>
              <button
                type="button"
                onClick={() => onJump(position)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`Question ${numbers[position]}, ${statusLabel}${
                  question.marked_for_review ? ", marked for review" : ""
                }`}
                className={cn(
                  "relative flex size-11 flex-col items-center justify-center rounded-md border text-sm font-medium transition-colors sm:size-10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : statusStyles[question.status],
                )}
              >
                <span className="tabular-nums">{numbers[position]}</span>
                <span aria-hidden="true" className="text-[10px] leading-none">
                  {question.status === "correct"
                    ? "C"
                    : question.status === "incorrect"
                      ? "X"
                      : "–"}
                  {question.marked_for_review ? "\u2022" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        <li>C — correct</li>
        <li>X — incorrect</li>
        <li>– — unanswered</li>
        <li>• — marked for review</li>
      </ul>
    </nav>
  );
}