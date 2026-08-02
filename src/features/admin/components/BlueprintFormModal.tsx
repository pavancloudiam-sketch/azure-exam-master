import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckboxField,
  Field,
  FieldError,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  TextField,
  type SelectOption,
} from "@/features/shared/components/ui";
import { blueprintSchema, type BlueprintInput } from "@/features/admin/validation/blueprint-schemas";
import { QUESTION_TYPE_LABELS, type BlueprintView } from "@/features/exams/types";
import type { Domain } from "@/features/admin/types/taxonomy";

export type BlueprintFormValues = BlueprintInput;

const MODE_OPTIONS: SelectOption[] = [
  { value: "realistic_mock", label: "Realistic mock exam" },
  { value: "practice", label: "Practice" },
  { value: "domain_practice", label: "Skill-area practice" },
  { value: "revision", label: "Revision" },
];

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS);

export function emptyBlueprintValues(certificationId: string): BlueprintFormValues {
  return {
    name: "",
    certification_id: certificationId,
    description: "",
    mode: "realistic_mock",
    duration_minutes: 100,
    min_question_count: 40,
    max_question_count: 60,
    default_question_count: 50,
    passing_scaled_score: 700,
    scoring_model_version: "v1",
    allowed_question_types: ["single_choice", "multiple_choice", "yes_no"],
    pilot_question_count: 0,
    case_study_count: 0,
    allow_partial_credit: true,
    randomize_questions: true,
    randomize_options: true,
    allow_repeats: false,
    repetition_cooldown_days: 14,
    max_repeat_count: 2,
    allow_case_study_return: true,
    domains: [],
  };
}

export function blueprintToValues(blueprint: BlueprintView): BlueprintFormValues {
  return {
    name: blueprint.name,
    certification_id: blueprint.certification_id,
    description: blueprint.description ?? "",
    mode: blueprint.mode,
    duration_minutes: blueprint.duration_minutes,
    min_question_count: blueprint.min_question_count,
    max_question_count: blueprint.max_question_count,
    default_question_count: blueprint.default_question_count,
    passing_scaled_score: blueprint.passing_scaled_score,
    scoring_model_version: blueprint.scoring_model_version,
    allowed_question_types: blueprint.allowed_question_types ?? [],
    pilot_question_count: blueprint.pilot_question_count,
    case_study_count: blueprint.case_study_count,
    allow_partial_credit: blueprint.allow_partial_credit,
    randomize_questions: blueprint.randomize_questions,
    randomize_options: blueprint.randomize_options,
    allow_repeats: blueprint.allow_repeats,
    repetition_cooldown_days: blueprint.repetition_cooldown_days,
    max_repeat_count: blueprint.max_repeat_count,
    allow_case_study_return: blueprint.allow_case_study_return,
    domains: blueprint.domains.map((d) => ({
      domain_id: d.domain_id,
      min_percent: d.min_percent,
      max_percent: d.max_percent,
    })),
  };
}

function numberOrZero(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function BlueprintFormModal({
  open,
  onOpenChange,
  initialValues,
  certifications,
  scoringModels,
  domains,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: BlueprintFormValues;
  certifications: SelectOption[];
  scoringModels: SelectOption[];
  domains: Domain[];
  submitLabel: string;
  onSubmit: (values: BlueprintFormValues) => Promise<void>;
}) {
  const [values, setValues] = React.useState<BlueprintFormValues>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof BlueprintFormValues>(key: K, value: BlueprintFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const certificationDomains = domains.filter(
    (d) => d.certification_id === values.certification_id,
  );
  const available = certificationDomains.filter(
    (d) => !values.domains.some((row) => row.domain_id === d.id),
  );

  const totalMin = values.domains.reduce((sum, d) => sum + d.min_percent, 0);
  const totalMax = values.domains.reduce((sum, d) => sum + d.max_percent, 0);

  const domainName = (id: string) =>
    certificationDomains.find((d) => d.id === id)?.name ?? "Unknown skill area";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = blueprintSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto shadow-overlay sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{submitLabel === "Create blueprint" ? "New blueprint" : "Edit blueprint"}</DialogTitle>
          <DialogDescription>
            Blueprints govern how many questions an attempt delivers, how they are weighted and how
            they are scored. Exact per-attempt allocation is calculated server-side.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <section className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="bp-name"
              label="Name"
              required
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors["name"]}
            />
            <SelectField
              id="bp-certification"
              label="Certification version"
              required
              options={certifications}
              value={values.certification_id}
              onValueChange={(v) => setValues((prev) => ({ ...prev, certification_id: v, domains: [] }))}
              error={errors["certification_id"]}
            />
            <div className="sm:col-span-2">
              <Field id="bp-description" label="Description" error={errors["description"]}>
                {({ describedBy, invalid }) => (
                  <Textarea
                    id="bp-description"
                    rows={3}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    value={values.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                )}
              </Field>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <SelectField
              id="bp-mode"
              label="Delivery mode"
              options={MODE_OPTIONS}
              value={values.mode}
              onValueChange={(v) => set("mode", v)}
              error={errors["mode"]}
            />
            <TextField
              id="bp-duration"
              label="Duration (minutes)"
              type="number"
              min={1}
              value={values.duration_minutes ?? ""}
              onChange={(e) =>
                set("duration_minutes", e.target.value === "" ? null : numberOrZero(e.target.value))
              }
              hint="Leave empty for untimed"
              error={errors["duration_minutes"]}
            />
            <SelectField
              id="bp-scoring"
              label="Scoring model"
              options={scoringModels}
              value={values.scoring_model_version}
              onValueChange={(v) => set("scoring_model_version", v)}
              error={errors["scoring_model_version"]}
            />
            <TextField
              id="bp-min"
              label="Minimum questions"
              type="number"
              value={values.min_question_count}
              onChange={(e) => set("min_question_count", numberOrZero(e.target.value))}
              error={errors["min_question_count"]}
            />
            <TextField
              id="bp-max"
              label="Maximum questions"
              type="number"
              value={values.max_question_count}
              onChange={(e) => set("max_question_count", numberOrZero(e.target.value))}
              error={errors["max_question_count"]}
            />
            <TextField
              id="bp-default"
              label="Default questions"
              type="number"
              value={values.default_question_count}
              onChange={(e) => set("default_question_count", numberOrZero(e.target.value))}
              error={errors["default_question_count"]}
            />
            <TextField
              id="bp-pass"
              label="Passing scaled score"
              type="number"
              value={values.passing_scaled_score}
              onChange={(e) => set("passing_scaled_score", numberOrZero(e.target.value))}
              hint="Out of 1000 on the practice scale"
              error={errors["passing_scaled_score"]}
            />
            <TextField
              id="bp-pilot"
              label="Pilot (unscored) questions"
              type="number"
              value={values.pilot_question_count}
              onChange={(e) => set("pilot_question_count", numberOrZero(e.target.value))}
              error={errors["pilot_question_count"]}
            />
            <TextField
              id="bp-case-studies"
              label="Case studies"
              type="number"
              value={values.case_study_count}
              onChange={(e) => set("case_study_count", numberOrZero(e.target.value))}
              error={errors["case_study_count"]}
            />
            <TextField
              id="bp-cooldown"
              label="Repetition cooldown (days)"
              type="number"
              value={values.repetition_cooldown_days}
              onChange={(e) => set("repetition_cooldown_days", numberOrZero(e.target.value))}
              error={errors["repetition_cooldown_days"]}
            />
            <TextField
              id="bp-max-repeat"
              label="Maximum repeats per question"
              type="number"
              value={values.max_repeat_count}
              onChange={(e) => set("max_repeat_count", numberOrZero(e.target.value))}
              error={errors["max_repeat_count"]}
            />
          </section>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Allowed question types</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUESTION_TYPES.map((type) => (
                <CheckboxField
                  key={type}
                  id={`bp-type-${type}`}
                  label={QUESTION_TYPE_LABELS[type] ?? type}
                  checked={values.allowed_question_types.includes(type)}
                  onCheckedChange={(checked) =>
                    set(
                      "allowed_question_types",
                      checked
                        ? [...values.allowed_question_types, type]
                        : values.allowed_question_types.filter((t) => t !== type),
                    )
                  }
                />
              ))}
            </div>
            <FieldError id="bp-types-error">{errors["allowed_question_types"]}</FieldError>
          </fieldset>

          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Delivery rules</legend>
            <CheckboxField
              id="bp-partial"
              label="Award partial credit"
              checked={values.allow_partial_credit}
              onCheckedChange={(c) => set("allow_partial_credit", c)}
            />
            <CheckboxField
              id="bp-rand-q"
              label="Randomise question order"
              checked={values.randomize_questions}
              onCheckedChange={(c) => set("randomize_questions", c)}
            />
            <CheckboxField
              id="bp-rand-o"
              label="Randomise answer options"
              checked={values.randomize_options}
              onCheckedChange={(c) => set("randomize_options", c)}
            />
            <CheckboxField
              id="bp-repeats"
              label="Allow recently seen questions"
              checked={values.allow_repeats}
              onCheckedChange={(c) => set("allow_repeats", c)}
            />
            <CheckboxField
              id="bp-cs-return"
              label="Allow returning to a case study section"
              checked={values.allow_case_study_return}
              onCheckedChange={(c) => set("allow_case_study_return", c)}
            />
          </fieldset>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Skill-area weighting</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <StatusBadge tone={totalMin <= 100 ? "neutral" : "error"}>
                  Minimums total {totalMin}%
                </StatusBadge>
                <StatusBadge tone={totalMax >= 100 ? "neutral" : "error"}>
                  Maximums total {totalMax}%
                </StatusBadge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Set the range each skill area may occupy. Exact question counts per attempt are
              calculated server-side inside these ranges.
            </p>

            {values.domains.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No skill areas added yet. Without weighting the blueprint draws from the whole bank.
              </p>
            ) : (
              <ul className="space-y-2">
                {values.domains.map((row, index) => (
                  <li
                    key={row.domain_id}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end"
                  >
                    <p className="min-w-0 truncate text-sm font-medium">{domainName(row.domain_id)}</p>
                    <TextField
                      id={`bp-domain-min-${row.domain_id}`}
                      label="Min %"
                      type="number"
                      value={row.min_percent}
                      onChange={(e) =>
                        setValues((prev) => {
                          const next = [...prev.domains];
                          next[index] = { ...next[index]!, min_percent: numberOrZero(e.target.value) };
                          return { ...prev, domains: next };
                        })
                      }
                    />
                    <TextField
                      id={`bp-domain-max-${row.domain_id}`}
                      label="Max %"
                      type="number"
                      value={row.max_percent}
                      onChange={(e) =>
                        setValues((prev) => {
                          const next = [...prev.domains];
                          next[index] = { ...next[index]!, max_percent: numberOrZero(e.target.value) };
                          return { ...prev, domains: next };
                        })
                      }
                    />
                    <SecondaryButton
                      type="button"
                      size="sm"
                      className="min-h-11"
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          domains: prev.domains.filter((d) => d.domain_id !== row.domain_id),
                        }))
                      }
                    >
                      Remove
                    </SecondaryButton>
                  </li>
                ))}
              </ul>
            )}

            {available.length > 0 ? (
              <SelectField
                id="bp-add-domain"
                label="Add skill area"
                placeholder="Select a skill area"
                options={available.map((d) => ({ value: d.id, label: d.name }))}
                value=""
                onValueChange={(domainId) =>
                  setValues((prev) => ({
                    ...prev,
                    domains: [...prev.domains, { domain_id: domainId, min_percent: 0, max_percent: 100 }],
                  }))
                }
              />
            ) : null}

            <FieldError id="bp-domains-error">{errors["domains"]}</FieldError>
          </section>

          {Object.keys(errors).length > 0 ? (
            <StatusAlert tone="error" title="Check the highlighted fields">
              Some values are outside the allowed range. Correct them and save again.
            </StatusAlert>
          ) : null}

          <DialogFooter>
            <SecondaryButton type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Saving…" : submitLabel}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
