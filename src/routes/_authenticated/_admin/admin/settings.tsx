import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/features/shared/components/PageShell";
import {
  ConfirmDialog,
  ErrorState,
  Field,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { appSettingsQueryKey } from "@/features/shared/hooks/use-app-settings";
import {
  fetchApplicationSettings,
  updateApplicationSettings,
  type ApplicationSettings,
} from "@/features/shared/services/settings-service";
import {
  applicationSettingsSchema,
  type ApplicationSettingsInput,
} from "@/features/shared/validation/settings-schemas";

type FormValues = {
  application_name: string;
  tagline: string;
  support_email: string;
  footer_disclaimer: string;
  application_version: string;
  default_passing_scaled_score: string;
  default_exam_duration_minutes: string;
};

function toValues(settings: ApplicationSettings): FormValues {
  return {
    application_name: settings.application_name,
    tagline: settings.tagline,
    support_email: settings.support_email,
    footer_disclaimer: settings.footer_disclaimer,
    application_version: settings.application_version,
    default_passing_scaled_score: String(settings.default_passing_scaled_score),
    default_exam_duration_minutes: String(settings.default_exam_duration_minutes),
  };
}

/** Fields that change platform-wide behaviour and need explicit confirmation. */
const SENSITIVE_FIELDS: Array<{ key: keyof FormValues; label: string }> = [
  { key: "application_version", label: "Application version" },
  { key: "default_passing_scaled_score", label: "Default passing scaled score" },
  { key: "footer_disclaimer", label: "Footer disclaimer" },
  { key: "support_email", label: "Support email" },
];

function SettingsAdminPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: appSettingsQueryKey, queryFn: fetchApplicationSettings });

  const [values, setValues] = React.useState<FormValues | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState<ApplicationSettingsInput | null>(null);

  const baseline = settings.data ? toValues(settings.data) : null;

  React.useEffect(() => {
    if (settings.data) setValues(toValues(settings.data));
  }, [settings.data]);

  const dirty = Boolean(values && baseline && JSON.stringify(values) !== JSON.stringify(baseline));

  // Browser-level unsaved-changes warning.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useMutation({
    mutationFn: (input: ApplicationSettingsInput) => updateApplicationSettings(input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(appSettingsQueryKey, saved);
      await queryClient.invalidateQueries({ queryKey: appSettingsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      notify.success("Application settings saved.");
    },
    onError: (error: Error) => notify.error(error.message || "Could not save settings."),
  });

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => (current ? { ...current, [key]: value } : current));
  }

  const changedSensitive = React.useMemo(() => {
    if (!values || !baseline) return [];
    return SENSITIVE_FIELDS.filter((field) => values[field.key] !== baseline[field.key]).map(
      (field) => field.label,
    );
  }, [values, baseline]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values) return;
    const parsed = applicationSettingsSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    if (changedSensitive.length > 0) {
      setPending(parsed.data);
      setConfirmOpen(true);
      return;
    }
    save.mutate(parsed.data);
  }

  return (
    <PageShell
      title="Application settings"
      description="Platform-wide branding and exam defaults. No credentials or secrets are stored here."
    >
      {settings.isLoading ? (
        <LoadingBlock label="Loading application settings" />
      ) : settings.isError ? (
        <ErrorState
          title="Settings unavailable"
          description="The application settings could not be loaded. The site keeps running on its built-in fallback values."
          onRetry={() => void settings.refetch()}
        />
      ) : values ? (
        <form onSubmit={handleSubmit} className="grid gap-6">
          {dirty ? (
            <StatusAlert tone="warning" title="Unsaved changes">
              You have unsaved changes on this page.
            </StatusAlert>
          ) : null}

          <SurfaceCard>
            <h2 className="text-lg font-semibold">Branding</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField
                id="application-name"
                label="Application name"
                value={values.application_name}
                onChange={(event) => set("application_name", event.target.value)}
                error={errors["application_name"]}
                required
              />
              <TextField
                id="tagline"
                label="Tagline"
                value={values.tagline}
                onChange={(event) => set("tagline", event.target.value)}
                error={errors["tagline"]}
                required
              />
              <TextField
                id="support-email"
                label="Support email"
                type="email"
                value={values.support_email}
                onChange={(event) => set("support_email", event.target.value)}
                error={errors["support_email"]}
                required
              />
              <TextField
                id="application-version"
                label="Application version"
                value={values.application_version}
                onChange={(event) => set("application_version", event.target.value)}
                error={errors["application_version"]}
                hint="Semantic version, for example 0.1.0"
                required
              />
              <div className="sm:col-span-2">
                <Field
                  id="footer-disclaimer"
                  label="Footer disclaimer"
                  error={errors["footer_disclaimer"]}
                  hint="Shown in the site footer on every page."
                >
                  {(a11y) => (
                    <Textarea
                      id={a11y.id}
                      rows={3}
                      aria-describedby={a11y.describedBy}
                      aria-invalid={a11y.invalid}
                      value={values.footer_disclaimer}
                      onChange={(event) => set("footer_disclaimer", event.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-lg font-semibold">Exam defaults</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Applied only when an admin creates a new exam. Existing exams are never changed.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField
                id="default-passing-score"
                label="Default passing scaled score"
                type="number"
                min={1}
                max={1000}
                value={values.default_passing_scaled_score}
                onChange={(event) => set("default_passing_scaled_score", event.target.value)}
                error={errors["default_passing_scaled_score"]}
                required
              />
              <TextField
                id="default-duration"
                label="Default exam duration (minutes)"
                type="number"
                min={1}
                max={600}
                value={values.default_exam_duration_minutes}
                onChange={(event) => set("default_exam_duration_minutes", event.target.value)}
                error={errors["default_exam_duration_minutes"]}
                required
              />
            </div>
          </SurfaceCard>

          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton type="submit" disabled={!dirty || save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              disabled={!dirty || save.isPending}
              onClick={() => {
                if (baseline) setValues(baseline);
                setErrors({});
              }}
            >
              Discard changes
            </SecondaryButton>
            {settings.data?.updated_at ? (
              <span className="text-sm text-muted-foreground">
                Last updated {new Date(settings.data.updated_at).toLocaleString()}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm platform-wide change"
        description={`These settings affect every user: ${changedSensitive.join(", ")}. The change is recorded in the admin audit log.`}
        confirmLabel="Save changes"
        onConfirm={() => {
          if (pending) save.mutate(pending);
          setConfirmOpen(false);
          setPending(null);
        }}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/settings")({
  head: () => ({
    meta: [
      { title: "Application settings — AskMeExam" },
      { name: "description", content: "Manage AskMeExam platform branding and exam defaults." },
      { property: "og:title", content: "Application settings — AskMeExam" },
      {
        property: "og:description",
        content: "Manage AskMeExam platform branding and exam defaults.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsAdminPage,
});
