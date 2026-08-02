import * as React from "react";
import type { ZodTypeAny } from "zod";

import { Modal } from "@/features/shared/components/ui/Modal";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  type SelectOption,
} from "@/features/shared/components/ui";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date";
  options?: SelectOption[];
  hint?: string;
  placeholder?: string;
  required?: boolean;
};

export type FormValues = Record<string, string>;

/**
 * Reusable create/edit modal form driven by a field definition list and a
 * Zod schema. Shared by certification, domain and topic management.
 */
export function EntityFormModal({
  open,
  onOpenChange,
  title,
  description,
  fields,
  schema,
  initialValues,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  schema: ZodTypeAny;
  initialValues: FormValues;
  submitLabel: string;
  onSubmit: (values: unknown) => Promise<void>;
}) {
  const [values, setValues] = React.useState<FormValues>(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
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
    <Modal open={open} onOpenChange={onOpenChange} title={title} {...(description ? { description } : {})}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {fields.map((field) => {
          const error = errors[field.name];
          const value = values[field.name] ?? "";
          if (field.type === "select") {
            return (
              <SelectField
                key={field.name}
                id={field.name}
                label={field.label}
                options={field.options ?? []}
                value={value}
                onValueChange={(next) => setValue(field.name, next)}
                hint={field.hint}
                error={error}
                required={field.required}
              />
            );
          }
          if (field.type === "textarea") {
            return (
              <Field
                key={field.name}
                id={field.name}
                label={field.label}
                hint={field.hint}
                error={error}
                required={field.required}
              >
                {({ describedBy, invalid }) => (
                  <Textarea
                    id={field.name}
                    value={value}
                    onChange={(event) => setValue(field.name, event.target.value)}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    rows={4}
                  />
                )}
              </Field>
            );
          }
          return (
            <TextField
              key={field.name}
              id={field.name}
              label={field.label}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={value}
              onChange={(event) => setValue(field.name, event.target.value)}
              hint={field.hint}
              error={error}
              required={field.required}
              {...(field.placeholder ? { placeholder: field.placeholder } : {})}
            />
          );
        })}
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