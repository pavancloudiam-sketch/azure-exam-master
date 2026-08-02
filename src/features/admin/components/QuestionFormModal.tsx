import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CheckboxField,
  Field,
  FieldError,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  type SelectOption,
} from "@/features/shared/components/ui";
import { questionSchema, type QuestionInput } from "../validation/question-schemas";
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  isMultipleChoice,
  isScenarioType,
  type Difficulty,
  type QuestionType,
  type QuestionWithOptions,
} from "../types/questions";

type OptionDraft = { id?: string; content: string; is_correct: boolean };

export type QuestionFormValues = {
  certification_id: string;
  domain_id: string;
  topic_id: string;
  question_type: QuestionType;
  scenario: string;
  stem: string;
  explanation: string;
  difficulty: Difficulty;
  points: string;
  is_active: boolean;
  options: OptionDraft[];
};

const typeOptions: SelectOption[] = (
  Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]
).map((value) => ({ value, label: QUESTION_TYPE_LABELS[value] }));

const difficultyOptions: SelectOption[] = (
  Object.keys(DIFFICULTY_LABELS) as Difficulty[]
).map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

export function emptyQuestionValues(certificationId: string): QuestionFormValues {
  return {
    certification_id: certificationId,
    domain_id: "",
    topic_id: "",
    question_type: "single_choice",
    scenario: "",
    stem: "",
    explanation: "",
    difficulty: "medium",
    points: "1",
    is_active: true,
    options: [
      { content: "", is_correct: false },
      { content: "", is_correct: false },
    ],
  };
}

export function questionToValues(
  question: QuestionWithOptions,
  domainId: string,
): QuestionFormValues {
  return {
    certification_id: question.certification_id,
    domain_id: domainId,
    topic_id: question.topic_id ?? "",
    question_type: question.question_type as QuestionType,
    scenario: question.scenario ?? "",
    stem: question.stem,
    explanation: question.explanation ?? "",
    difficulty: question.difficulty as Difficulty,
    points: String(question.points),
    is_active: question.is_active,
    options: question.options.map((option) => ({
      id: option.id,
      content: option.content,
      is_correct: option.is_correct,
    })),
  };
}

export function QuestionFormModal({
  open,
  onOpenChange,
  initialValues,
  certificationOptions,
  domainOptions,
  topicOptionsFor,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: QuestionFormValues;
  certificationOptions: SelectOption[];
  domainOptions: (certificationId: string) => SelectOption[];
  topicOptionsFor: (domainId: string) => SelectOption[];
  submitLabel: string;
  onSubmit: (input: QuestionInput) => Promise<void>;
}) {
  const [values, setValues] = React.useState<QuestionFormValues>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof QuestionFormValues>(key: K, value: QuestionFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const multiple = isMultipleChoice(values.question_type);
  const scenarioRequired = isScenarioType(values.question_type);

  function setOption(index: number, patch: Partial<OptionDraft>) {
    setValues((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    }));
  }

  function toggleCorrect(index: number, checked: boolean) {
    setValues((current) => ({
      ...current,
      options: current.options.map((option, i) => {
        if (i === index) return { ...option, is_correct: checked };
        return isMultipleChoice(current.question_type)
          ? option
          : { ...option, is_correct: checked ? false : option.is_correct };
      }),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = questionSchema.safeParse({
      ...values,
      scenario: values.scenario,
      options: values.options,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        const topKey = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
        if (!next[topKey]) next[topKey] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-overlay max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{submitLabel === "Create question" ? "New question" : "Edit question"}</DialogTitle>
          <DialogDescription>
            Questions belong to a certification, domain and topic, and can be reused across exams.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-3">
            <SelectField
              id="certification_id"
              label="Certification"
              required
              options={certificationOptions}
              value={values.certification_id}
              onValueChange={(next) =>
                setValues((current) => ({
                  ...current,
                  certification_id: next,
                  domain_id: "",
                  topic_id: "",
                }))
              }
              error={errors["certification_id"]}
            />
            <SelectField
              id="domain_id"
              label="Domain"
              required
              options={domainOptions(values.certification_id)}
              value={values.domain_id}
              onValueChange={(next) =>
                setValues((current) => ({ ...current, domain_id: next, topic_id: "" }))
              }
              error={errors["domain_id"]}
            />
            <SelectField
              id="topic_id"
              label="Topic"
              required
              options={topicOptionsFor(values.domain_id)}
              value={values.topic_id}
              onValueChange={(next) => set("topic_id", next)}
              error={errors["topic_id"]}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <SelectField
              id="question_type"
              label="Question type"
              required
              options={typeOptions}
              value={values.question_type}
              onValueChange={(next) => set("question_type", next as QuestionType)}
              error={errors["question_type"]}
            />
            <SelectField
              id="difficulty"
              label="Difficulty"
              required
              options={difficultyOptions}
              value={values.difficulty}
              onValueChange={(next) => set("difficulty", next as Difficulty)}
              error={errors["difficulty"]}
            />
            <TextField
              id="points"
              label="Point value"
              type="number"
              min={1}
              required
              value={values.points}
              onChange={(event) => set("points", event.target.value)}
              error={errors["points"]}
            />
          </div>

          {scenarioRequired ? (
            <Field
              id="scenario"
              label="Scenario text"
              required
              error={errors["scenario"]}
              hint="Shown above the question for scenario-based items."
            >
              {({ describedBy, invalid }) => (
                <Textarea
                  id="scenario"
                  rows={4}
                  value={values.scenario}
                  onChange={(event) => set("scenario", event.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              )}
            </Field>
          ) : null}

          <Field id="stem" label="Question text" required error={errors["stem"]}>
            {({ describedBy, invalid }) => (
              <Textarea
                id="stem"
                rows={3}
                value={values.stem}
                onChange={(event) => set("stem", event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
              />
            )}
          </Field>

          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">
              Answer options{" "}
              <span className="font-normal text-muted-foreground">
                ({multiple ? "mark at least two correct" : "mark exactly one correct"})
              </span>
            </legend>
            {values.options.map((option, index) => (
              <div key={option.id ?? `new-${index}`} className="flex items-start gap-3">
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id={`option-correct-${index}`}
                    checked={option.is_correct}
                    onCheckedChange={(state) => toggleCorrect(index, state === true)}
                  />
                  <Label htmlFor={`option-correct-${index}`} className="text-xs text-muted-foreground">
                    Correct
                  </Label>
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    aria-label={`Answer option ${index + 1}`}
                    value={option.content}
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    onChange={(event) => setOption(index, { content: event.target.value })}
                    aria-invalid={errors[`options.${index}.content`] ? true : undefined}
                  />
                  <FieldError>{errors[`options.${index}.content`]}</FieldError>
                </div>
                <SecondaryButton
                  type="button"
                  size="sm"
                  disabled={values.options.length <= 2}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      options: current.options.filter((_, i) => i !== index),
                    }))
                  }
                >
                  Remove
                </SecondaryButton>
              </div>
            ))}
            <FieldError>{errors["options"]}</FieldError>
            <SecondaryButton
              type="button"
              size="sm"
              disabled={values.options.length >= 8}
              onClick={() =>
                setValues((current) => ({
                  ...current,
                  options: [...current.options, { content: "", is_correct: false }],
                }))
              }
            >
              Add option
            </SecondaryButton>
          </fieldset>

          <Field id="explanation" label="Explanation" required error={errors["explanation"]}>
            {({ describedBy, invalid }) => (
              <Textarea
                id="explanation"
                rows={3}
                value={values.explanation}
                onChange={(event) => set("explanation", event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
              />
            )}
          </Field>

          <CheckboxField
            id="is_active"
            label="Active (available for exam delivery)"
            checked={values.is_active}
            onCheckedChange={(checked) => set("is_active", checked)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <SecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" loading={submitting}>
              {submitLabel}
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}