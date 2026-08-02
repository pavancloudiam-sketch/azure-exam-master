import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  SurfaceCard,
  TextField,
  PasswordField,
  notify,
} from "@/features/shared/components/ui";
import {
  loginSchema,
  registerSchema,
  fieldErrors,
} from "@/features/auth/validation/schemas";
import {
  registerWithPassword,
  safeRedirect,
  signInWithPassword,
} from "@/features/auth/services/auth-service";
import { describeError, logError, shortReference } from "@/features/observability";
import {
  flushPendingAcceptance,
  markAcceptancePending,
  recordLegalAcceptance,
} from "@/features/legal/services/legal-service";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "register"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — AskMeExam" },
      {
        name: "description",
        content: "Sign in or create an AskMeExam account to practise Microsoft Entra ID exams.",
      },
      { property: "og:title", content: "Sign in — AskMeExam" },
      { property: "og:description", content: "Access your AskMeExam practice dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<"login" | "register">(search.mode ?? "login");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = React.useState(false);
  const [acceptError, setAcceptError] = React.useState<string | null>(null);

  const destination = safeRedirect(search.redirect);

  // Destinations that carry a query string (the OAuth consent hand-off) are not
  // typed router paths, so they need a plain browser navigation.
  const goToDestination = React.useCallback(() => {
    if (destination.includes("?")) {
      window.location.assign(destination);
      return;
    }
    void navigate({ to: destination, replace: true });
  }, [destination, navigate]);

  // Already signed in? Go straight to the destination.
  React.useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) goToDestination();
    });
  }, [goToDestination]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});
    const form = new FormData(event.currentTarget);

    if (mode === "login") {
      const parsed = loginSchema.safeParse({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));

      setSubmitting(true);
      const { error } = await signInWithPassword(parsed.data.email, parsed.data.password);
      setSubmitting(false);
      if (error) {
        // The email and password never reach the log — only the failure shape.
        const requestId = logError("auth.login_failed", "Sign-in attempt failed", error);
        const described = describeError(error, requestId);
        return setFormError(
          error.message.toLowerCase().includes("invalid login")
            ? "That email and password combination isn't recognised. Check them and try again."
            : `${described.message} ${described.retryGuidance} (ref ${shortReference(requestId)})`,
        );
      }
      notify.success("Signed in");
      // Captures a registration acceptance that could not be stored before
      // the email was confirmed. Never records anything the user did not tick.
      void flushPendingAcceptance();
      goToDestination();
      return;
    }

    if (!acceptedPolicies) {
      return setAcceptError(
        "Please confirm you have read and accept the Terms of Service, Privacy Policy and Refund Policy.",
      );
    }
    setAcceptError(null);

    const parsed = registerSchema.safeParse({
      fullName: form.get("fullName"),
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));

    setSubmitting(true);
    const { data, error } = await registerWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
    });
    setSubmitting(false);
    if (error) {
      const requestId = logError("auth.register_failed", "Registration attempt failed", error);
      return setFormError(`${error.message} (ref ${shortReference(requestId)})`);
    }

    if (data.session) {
      notify.success("Account created");
      void recordLegalAcceptance("registration").catch(() => markAcceptancePending());
      goToDestination();
      return;
    }
    setPendingConfirmation(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">
        {mode === "login" ? "Sign in to AskMeExam" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login"
          ? "Use your email and password to continue."
          : "New accounts start with the student role."}
      </p>

      <SurfaceCard className="mt-6">
        {pendingConfirmation ? (
          <StatusAlert tone="success" title="Check your email">
            We sent a confirmation link to your inbox. Confirm your address, then sign in.
          </StatusAlert>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError ? (
              <StatusAlert tone="error" title="Could not continue">
                {formError}
              </StatusAlert>
            ) : null}

            {mode === "register" ? (
              <TextField
                id="fullName"
                name="fullName"
                label="Full name"
                autoComplete="name"
                required
                error={errors["fullName"]}
              />
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
            <PasswordField
              id="password"
              name="password"
              label="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              error={errors["password"]}
              {...(mode === "register" ? { hint: "At least 8 characters." } : {})}
            />
            {mode === "register" ? (
              <PasswordField
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm password"
                autoComplete="new-password"
                required
                error={errors["confirmPassword"]}
              />
            ) : null}

            {mode === "register" ? (
              <div className="rounded-md border border-border bg-surface p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={acceptedPolicies}
                    onChange={(event) => setAcceptedPolicies(event.currentTarget.checked)}
                    aria-describedby="policy-acceptance-hint"
                  />
                  <span>
                    I have read and accept the{" "}
                    <Link to="/legal/$docSlug" params={{ docSlug: "terms" }} className="underline">
                      Terms of Service
                    </Link>
                    ,{" "}
                    <Link
                      to="/legal/$docSlug"
                      params={{ docSlug: "privacy" }}
                      className="underline"
                    >
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/legal/$docSlug"
                      params={{ docSlug: "refunds" }}
                      className="underline"
                    >
                      Refund Policy
                    </Link>
                    .
                  </span>
                </label>
                <p id="policy-acceptance-hint" className="mt-2 text-xs text-muted-foreground">
                  These documents are placeholder drafts pending professional review. Your
                  acceptance and the version you accepted are recorded against your account.
                </p>
                {acceptError ? (
                  <p role="alert" className="mt-2 text-xs text-destructive-ink">
                    {acceptError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <PrimaryButton type="submit" className="w-full" loading={submitting}>
              {mode === "login" ? "Sign in" : "Create account"}
            </PrimaryButton>
          </form>
        )}

        {pendingConfirmation ? null : (
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Or continue with
            </p>
            <SecondaryButton
              type="button"
              className="mt-3 w-full"
              onClick={async () => {
                // The redirect target is always this app's public origin: a
                // protected route would be hit before the session is set.
                // Always return to this public page, carrying the intended
                // destination so the consent hand-off survives the round-trip.
                const returnTo = new URL("/auth", window.location.origin);
                if (search.redirect) returnTo.searchParams.set("redirect", destination);
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: returnTo.toString(),
                });
                if (result.error) {
                  const requestId = logError(
                    "auth.oauth_failed",
                    "Google sign-in failed",
                    result.error,
                  );
                  setFormError(
                    `Google sign-in could not be completed. Try again or use your password. (ref ${shortReference(requestId)})`,
                  );
                }
              }}
            >
              Continue with Google
            </SecondaryButton>
            <p className="mt-3 text-xs text-muted-foreground">
              Signing in with a work account from an organisation that has configured Microsoft
              Entra ID federation is coming next; the configuration is captured in your organisation
              settings today.
            </p>
          </div>
        )}
      </SurfaceCard>

      <div className="mt-6 space-y-2 text-sm">
        <p>
          {mode === "login" ? "Don't have an account?" : "Already registered?"}{" "}
          <button
            type="button"
            className="font-medium text-accent-ink underline-offset-4 hover:underline"
            onClick={() => {
              setPendingConfirmation(false);
              setErrors({});
              setFormError(null);
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </p>
        <p>
          <Link
            to="/forgot-password"
            className="font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
      </div>
    </main>
  );
}