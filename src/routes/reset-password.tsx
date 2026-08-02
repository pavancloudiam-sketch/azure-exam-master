import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import {
  PasswordField,
  PrimaryButton,
  StatusAlert,
  SurfaceCard,
  notify,
} from "@/features/shared/components/ui";
import { resetPasswordSchema, fieldErrors } from "@/features/auth/validation/schemas";
import { updatePassword } from "@/features/auth/services/auth-service";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — AskMeExam" },
      { name: "description", content: "Set a new password for your AskMeExam account." },
      { property: "og:title", content: "Choose a new password — AskMeExam" },
      { property: "og:description", content: "Set a new AskMeExam password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);
  const [recoverySession, setRecoverySession] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const hash = window.location.hash;
    const isRecoveryLink = hash.includes("type=recovery");

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setRecoverySession(Boolean(data.session) || isRecoveryLink);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));

    setSubmitting(true);
    const { error } = await updatePassword(parsed.data.password);
    setSubmitting(false);
    if (error) return setFormError(error.message);
    notify.success("Password updated");
    void navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <SurfaceCard className="mt-6">
        {ready && !recoverySession ? (
          <StatusAlert tone="warning" title="Reset link required">
            Open the reset link from your email to set a new password.
          </StatusAlert>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError ? (
              <StatusAlert tone="error" title="Could not update password">
                {formError}
              </StatusAlert>
            ) : null}
            <PasswordField
              id="password"
              name="password"
              label="New password"
              autoComplete="new-password"
              hint="At least 8 characters."
              required
              error={errors["password"]}
            />
            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
              required
              error={errors["confirmPassword"]}
            />
            <PrimaryButton type="submit" className="w-full" loading={submitting}>
              Update password
            </PrimaryButton>
          </form>
        )}
      </SurfaceCard>
    </main>
  );
}