import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  PrimaryButton,
  StatusAlert,
  SurfaceCard,
  TextField,
} from "@/features/shared/components/ui";
import { forgotPasswordSchema, fieldErrors } from "@/features/auth/validation/schemas";
import { sendPasswordReset } from "@/features/auth/services/auth-service";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — AskMeExam" },
      { name: "description", content: "Request an AskMeExam password reset link by email." },
      { property: "og:title", content: "Reset your password — AskMeExam" },
      { property: "og:description", content: "Request an AskMeExam password reset link." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({ email: form.get("email") });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));

    setSubmitting(true);
    const { error } = await sendPasswordReset(parsed.data.email);
    setSubmitting(false);
    if (error) return setFormError(error.message);
    setSent(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We'll email you a link to choose a new one.
      </p>
      <SurfaceCard className="mt-6">
        {sent ? (
          <StatusAlert tone="success" title="Check your email">
            If an account exists for that address, a reset link is on its way.
          </StatusAlert>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError ? (
              <StatusAlert tone="error" title="Could not send the link">
                {formError}
              </StatusAlert>
            ) : null}
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              error={errors["email"]}
            />
            <PrimaryButton type="submit" className="w-full" loading={submitting}>
              Send reset link
            </PrimaryButton>
          </form>
        )}
      </SurfaceCard>
      <p className="mt-6 text-sm">
        <Link to="/auth" className="font-medium text-accent-ink underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}