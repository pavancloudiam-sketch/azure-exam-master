import { SurfaceCard, StatusBadge } from "@/features/shared/components/ui";
import { cn } from "@/lib/utils";
import { REVIEW_STATUS_LABELS, type ReviewQuestion } from "../types";

function optionTone(isCorrect: boolean, isSelected: boolean) {
  if (isCorrect) return "border-success/40 bg-success/10";
  if (isSelected) return "border-destructive/50 bg-destructive/10";
  return "border-border bg-background";
}

/** Read-only presentation of one reviewed question. Nothing here is editable. */
export function ReviewQuestionCard({
  question,
  number,
  total,
}: {
  question: ReviewQuestion;
  number: number;
  total: number;
}) {
  const statusTone =
    question.status === "correct"
      ? "success"
      : question.status === "partial"
        ? "warning"
        : question.status === "incorrect"
          ? "error"
          : "neutral";

  const yesNo = question.question_type === "yes_no";
  const responses = question.statement_responses ?? {};
  const earned = question.earned_points;

  const selected = question.options.filter((option) =>
    question.selected_option_ids.includes(option.id),
  );
  const correct = question.options.filter((option) => option.is_correct);

  return (
    <SurfaceCard>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">
            Question {number} of {total}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{question.stem}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={statusTone}>{REVIEW_STATUS_LABELS[question.status]}</StatusBadge>
          {question.marked_for_review ? (
            <StatusBadge tone="warning">Marked for review</StatusBadge>
          ) : null}
          <StatusBadge tone="info">
            {earned !== null && earned !== undefined
              ? `${Number(earned).toFixed(2).replace(/\.00$/, "")} of ${question.points} ${
                  question.points === 1 ? "point" : "points"
                }`
              : `${question.points} ${question.points === 1 ? "point" : "points"}`}
          </StatusBadge>
          {question.is_pilot ? (
            <StatusBadge tone="neutral">Unscored trial question</StatusBadge>
          ) : null}
        </div>
      </header>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Domain</dt>
          <dd className="font-medium">{question.domain_name ?? "Not categorised"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Topic</dt>
          <dd className="font-medium">{question.topic_name ?? "Not categorised"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Difficulty</dt>
          <dd className="font-medium capitalize">{question.difficulty}</dd>
        </div>
      </dl>

      {question.case_study_title ? (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span className="font-semibold">Case study:</span> {question.case_study_title}
        </p>
      ) : null}

      {question.scenario ? (
        <section aria-label="Scenario" className="mt-5 rounded-md border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold">Scenario</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">{question.scenario}</p>
        </section>
      ) : null}

      {yesNo ? (
        <section aria-label="Answer options" className="mt-5">
          <h3 className="text-sm font-semibold">Statements</h3>
          <ul className="mt-2 space-y-2">
            {question.options.map((option, position) => {
              const correctAnswer = option.is_correct ? "Yes" : "No";
              const recorded = responses[option.id];
              const given = recorded
                ? recorded === "yes"
                  ? "Yes"
                  : "No"
                : question.selected_option_ids.includes(option.id)
                  ? "Yes"
                  : "Not answered";
              const right = given === correctAnswer;
              return (
                <li
                  key={option.id}
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    given === "Not answered"
                      ? "border-border bg-background"
                      : right
                        ? "border-success/40 bg-success/10"
                        : "border-destructive/50 bg-destructive/10",
                  )}
                >
                  <p>
                    <span className="font-semibold">Statement {position + 1}.</span>{" "}
                    {option.content}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-2 text-xs">
                    <StatusBadge tone={right ? "success" : given === "Not answered" ? "neutral" : "error"}>
                      Your answer: {given}
                    </StatusBadge>
                    <StatusBadge tone="success">Correct answer: {correctAnswer}</StatusBadge>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <>
      <section aria-label="Answer options" className="mt-5">
          <h3 className="text-sm font-semibold">Options</h3>
          <ul className="mt-2 space-y-2">
            {question.options.map((option) => {
              const isSelected = question.selected_option_ids.includes(option.id);
              return (
                <li
                  key={option.id}
                  className={cn(
                    "rounded-md border p-3 text-sm",
                    optionTone(option.is_correct, isSelected),
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span>
                      <span className="font-semibold">{option.label}.</span> {option.content}
                    </span>
                    <span className="flex shrink-0 flex-wrap gap-2">
                      {option.is_correct ? (
                        <StatusBadge tone="success">Correct answer</StatusBadge>
                      ) : null}
                      {isSelected ? <StatusBadge tone="info">Your answer</StatusBadge> : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <dl className="mt-5 space-y-2 text-sm">
          <div>
            <dt className="font-semibold">Your answer</dt>
            <dd className="text-muted-foreground">
              {selected.length > 0
                ? selected.map((option) => option.label).join(", ")
                : "Not answered"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Correct answer</dt>
            <dd className="text-muted-foreground">
              {correct.length > 0 ? correct.map((option) => option.label).join(", ") : "Not recorded"}
            </dd>
          </div>
        </dl>

        <dl className="mt-5 space-y-2 text-sm">
          <div>
            <dt className="font-semibold">Your answer</dt>
            <dd className="text-muted-foreground">
              {selected.length > 0
                ? selected.map((option) => option.label).join(", ")
                : "Not answered"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Correct answer</dt>
            <dd className="text-muted-foreground">
              {correct.length > 0
                ? correct.map((option) => option.label).join(", ")
                : "Not recorded"}
            </dd>
          </div>
        </dl>
        </>
      )}

      <section aria-label="Explanation" className="mt-5 rounded-md border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold">Explanation</h3>
        <p className="mt-1 whitespace-pre-line text-sm text-foreground">
          {question.explanation ?? "No explanation was recorded for this question."}
        </p>
      </section>
    </SurfaceCard>
  );
}