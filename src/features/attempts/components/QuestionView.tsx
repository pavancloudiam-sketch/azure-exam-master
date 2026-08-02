import { cn } from "@/lib/utils";
import { StatusBadge } from "@/features/shared/components/ui";
import type { AnswerState, ExamQuestionView } from "../types";

export function QuestionView({
  question,
  position,
  total,
  answer,
  onSelect,
}: {
  question: ExamQuestionView;
  position: number;
  total: number;
  answer: AnswerState;
  onSelect: (optionId: string) => void;
}) {
  const multi = question.question_type.endsWith("multiple_choice");
  const groupName = `question-${question.question_id}`;

  return (
    <section aria-labelledby={`${groupName}-stem`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Question {position + 1} of {total}
        </p>
        <StatusBadge tone={multi ? "info" : "neutral"}>
          {multi ? "Select all that apply" : "Select one"}
        </StatusBadge>
        {answer.markedForReview ? <StatusBadge tone="warning">Marked</StatusBadge> : null}
      </div>

      {question.scenario ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Scenario
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{question.scenario}</p>
        </div>
      ) : null}

      <h2 id={`${groupName}-stem`} className="mt-5 text-xl leading-snug">
        {question.stem}
      </h2>

      <fieldset className="mt-5">
        <legend className="sr-only">
          {multi ? "Choose all correct answers" : "Choose one answer"}
        </legend>
        <ul className="space-y-3">
          {question.options.map((option) => {
            const checked = answer.selected.includes(option.id);
            return (
              <li key={option.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    "hover:border-accent/60 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    checked ? "border-accent bg-accent/10" : "border-border bg-background",
                  )}
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={groupName}
                    value={option.id}
                    checked={checked}
                    onChange={() => onSelect(option.id)}
                    className="mt-1 size-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-sm leading-relaxed">
                    {option.label ? (
                      <span className="mr-2 font-semibold">{option.label}.</span>
                    ) : null}
                    {option.content}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </section>
  );
}