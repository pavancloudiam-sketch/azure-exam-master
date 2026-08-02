import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function FieldLabel({
  children,
  required,
  className,
  ...props
}: React.ComponentProps<typeof Label> & { required?: boolean | undefined }) {
  return (
    <Label className={cn("text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-destructive-ink" aria-hidden="true">
          *
        </span>
      ) : null}
    </Label>
  );
}

export function FieldError({
  id,
  children,
}: {
  id?: string | undefined;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive-ink">
      {children}
    </p>
  );
}

export function FieldHint({
  id,
  children,
}: {
  id?: string | undefined;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {children}
    </p>
  );
}

type FieldWrapperProps = {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean | undefined;
  children: (a11y: {
    id: string;
    describedBy?: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
};

export function Field({ id, label, hint, error, required, children }: FieldWrapperProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {children({ id, describedBy, invalid: Boolean(error) })}
      <FieldHint id={hintId}>{hint}</FieldHint>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

const invalidRing = "aria-invalid:border-destructive aria-invalid:ring-destructive";

export type TextFieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
};

export function TextField({ id, label, hint, error, required, ...props }: TextFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <Input
          id={id}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={invalidRing}
          {...props}
        />
      )}
    </Field>
  );
}

export function PasswordField({ id, label, hint, error, required, ...props }: TextFieldProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <div className="relative">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn("pr-11", invalidRing)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </Field>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

export function SelectField({
  id,
  label,
  options,
  placeholder = "Select an option",
  value,
  defaultValue,
  onValueChange,
  hint,
  error,
  required,
  disabled,
}: {
  id: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <Select
          {...({ value, defaultValue, onValueChange, disabled } as React.ComponentProps<
            typeof Select
          >)}
        >
          <SelectTrigger
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn("w-full", invalidRing)}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                {...({ disabled: option.disabled } as { disabled?: boolean })}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

export function CheckboxField({
  id,
  label,
  hint,
  error,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          onCheckedChange={(state) => onCheckedChange?.(state === true)}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className="mt-0.5"
          {...({ checked, defaultChecked, disabled } as React.ComponentProps<typeof Checkbox>)}
        />
        <Label htmlFor={id} className="text-sm leading-5 font-normal text-foreground">
          {label}
        </Label>
      </div>
      <FieldHint id={hintId}>{hint}</FieldHint>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function RadioField({
  name,
  legend,
  options,
  value,
  defaultValue,
  onValueChange,
  hint,
  error,
  disabled,
}: {
  name: string;
  legend: string;
  options: SelectOption[];
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean | undefined;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <RadioGroup
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="gap-2"
        {...({ value, defaultValue, onValueChange } as React.ComponentProps<typeof RadioGroup>)}
      >
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <div key={option.value} className="flex items-center gap-3">
              <RadioGroupItem
                id={id}
                value={option.value}
                {...({ disabled: option.disabled } as { disabled?: boolean })}
              />
              <Label htmlFor={id} className="text-sm font-normal text-foreground">
                {option.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      <FieldHint id={hintId}>{hint}</FieldHint>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}