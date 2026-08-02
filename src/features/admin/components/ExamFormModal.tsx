import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/features/shared/components/ui/Modal";
import {
  CheckboxField,
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  TextField,
  type SelectOption,
} from "@/features/shared/components/ui";
import { examSchema, type ExamInput } from "../validation/exam-schemas";
import type { Exam } from "../types/questions";

export type ExamFormValues = {
  certification_id: string;
  title: string;
  description: string;
  instructions: string;
  question_count: string;
  passing_score: string;
  time_limit_minutes: string;
  allow_timed: boolean;
  allow_practice: boolean;
  is_active: boolean;
};

export function emptyExamValues(
  certificationId: string,
  defaults?: { passingScore?: number; durationMinutes?: number },
): ExamFormValues {
  return {
    certification_id: certificationId,
    title: "",
    description: "",
    instructions: "",
    question_count: "40",
    passing_score: String(defaults?.passingScore ?? 700),
    time_limit_minutes: String(defaults?.durationMinutes ?? 60),
    allow_timed: true,
    allow_practice: true,
    is_active: true,
  };
}

export function examToValues(exam: Exam): ExamFormValues {
  return {
    certification_id: exam.certification_id,
    title: exam.title,
    description: exam.description ?? "",
    instructions: exam.instructions ?? "",
    question_count: String(exam.question_count),
    passing_score: String(exam.passing_score),
    time_limit_minutes: exam.time_limit_minutes === null ? "" : String(exam.time_limit_minutes),
    allow_timed: exam.allow_timed,
    allow_practice: exam.allow_practice,
    is_active: exam.is_active,
  };
}

/** Create/edit form for an exam. Mirrors the database CHECK constraints. */
export function ExamFormModal({
  open,
  onOpenChange,
  title,
  certificationOptions,
  initialValues,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  certificationOptions: SelectOption[];
  initialValues: ExamFormValues;
  submitLabel: string;
  onSubmit: (input: ExamInput) => Promise<void>;
}) {
  const [values, setValues] = React.useState<ExamFormValues>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof ExamFormValues>(key: K, value: ExamFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = examSchema.safeParse({
      ...values,
      time_limit_minutes: values.time_limit_minutes.trim() === "" ? null : values.time_limit_minutes,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Exams stay hidden from students until they are active, published and contain at least one active question."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <SelectField
          id="exam-certification"
          label="Certification"
          required
          options={certificationOptions}
          value={values.certification_id}
          onValueChange={(next) => set("certification_id", next)}
          error={errors["certification_id"]}
        />
        <TextField
          id="exam-title"
          label="Exam title"
          required
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
          error={errors["title"]}
        />
        <Field id="exam-description" label="Description" error={errors["description"]}>
          {({ describedBy, invalid }) => (
            <Textarea
              id="exam-description"
              rows={3}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </Field>
        <Field
          id="exam-instructions"
          label="Instructions"
          hint="Shown to students before they start the exam."
          error={errors["instructions"]}
        >
          {({ describedBy, invalid }) => (
            <Textarea
              id="exam-instructions"
              rows={4}
              value={values.instructions}
              onChange={(event) => set("instructions", event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            id="exam-question-count"
            label="Question count"
            type="number"
            required
            value={values.question_count}
            onChange={(event) => set("question_count", event.target.value)}
            error={errors["question_count"]}
          />
          <TextField
            id="exam-passing-score"
            label="Passing scaled score"
            type="number"
            required
            hint="Out of 1000"
            value={values.passing_score}
            onChange={(event) => set("passing_score", event.target.value)}
            error={errors["passing_score"]}
          />
          <TextField
            id="exam-duration"
            label="Duration (minutes)"
            type="number"
            hint="Required for Timed Mock"
            value={values.time_limit_minutes}
            onChange={(event) => set("time_limit_minutes", event.target.value)}
            error={errors["time_limit_minutes"]}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Available modes</legend>
          <CheckboxField
            id="exam-allow-timed"
            label="Timed Mock mode"
            checked={values.allow_timed}
            onCheckedChange={(checked) => set("allow_timed", checked)}
            error={errors["allow_timed"]}
          />
          <CheckboxField
            id="exam-allow-practice"
            label="Practice mode"
            checked={values.allow_practice}
            onCheckedChange={(checked) => set("allow_practice", checked)}
          />
        </fieldset>

        <CheckboxField
          id="exam-is-active"
          label="Active"
          hint="Inactive exams are hidden from students but keep all history."
          checked={values.is_active}
          onCheckedChange={(checked) => set("is_active", checked)}
        />

        <StatusAlert tone="info" title="Publishing is separate">
          Saving does not publish the exam. Publish it from the exam list once the questions are
          assigned.
        </StatusAlert>

        <div className="flex justify-end gap-3 pt-2">
          <SecondaryButton type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" loading={submitting}>
            {submitLabel}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}