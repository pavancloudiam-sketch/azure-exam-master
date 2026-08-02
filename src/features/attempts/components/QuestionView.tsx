import { cn } from "@/lib/utils";
import { StatusBadge } from "@/features/shared/components/ui";
import type { AnswerState, ExamQuestionView, StatementResponse } from "../types";

const QUESTION_TYPE_HINT: Record<string, string> = {
  yes_no: "Answer Yes or No for every statement",
  single_choice: "Select one",
  multiple_choice: "Select all that apply",
};

function YesNoStatements({
  question,
  answer,
  onStatement,
}: {
  question: ExamQuestionView;
  answer: AnswerState;
  onStatement: (statementId: string, value: StatementResponse) => void;
}) {
  const responses = answer.statementResponses ?? {};
  const remaining = question.options.filter((o) => responses[o.id] === undefined).length;

  return (
    <div className="mt-5">
      <p className="text-sm text-muted-foreground">
        Each statement is answered separately. Every statement must be answered before this
        question counts as complete.
      </p>
      <ul className="mt-3 space-y-3">
        {question.options.map((option, position) => {
          const value = responses[option.id];
          return (
            <li
              key={option.id}
              className={cn(
                "rounded-lg border p-4",
                value ? "border-accent bg-accent/5" : "border-border bg-background",
              )}
            >
              <fieldset>
                <legend className="text-sm leading-relaxed">
                  <span className="mr-2 font-semibold">Statement {position + 1}.</span>
                  {option.content}
                </legend>
                <div className="mt-3 flex gap-2">
                  {(["yes", "no"] as const).map((choice) => {
                    const checked = value === choice;
                    return (
                      <label
                        key={choice}
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
                          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-accent",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`statement-${option.id}`}
                          value={choice}
                          checked={checked}
                          onChange={() => onStatement(option.id, choice)}
                        />
                        {choice === "yes" ? "Yes" : "No"}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        {remaining === 0
          ? "All statements answered."
          : `${remaining} statement${remaining === 1 ? "" : "s"} still to answer.`}
      </p>
    </div>
  );
}

export function QuestionView({
  question,
  position,
  total,
  answer,
  onSelect,
  onStatement,
}: {
  question: ExamQuestionView;
  position: number;
  total: number;
  answer: AnswerState;
  onSelect: (optionId: string) => void;
  onStatement?: (statementId: string, value: StatementResponse) => void;
}) {
  const yesNo = question.question_type === "yes_no";
  const multi = question.question_type.endsWith("multiple_choice");
  const groupName = `question-${question.question_id}`;

  return (
    <section aria-labelledby={`${groupName}-stem`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Question {position + 1} of {total}
        </p>
        <StatusBadge tone={yesNo || multi ? "info" : "neutral"}>
          {QUESTION_TYPE_HINT[question.question_type] ??
            (multi ? "Select all that apply" : "Select one")}
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

      {yesNo && onStatement ? (
        <YesNoStatements question={question} answer={answer} onStatement={onStatement} />
      ) : (
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
      )}
    </section>
  );
}
