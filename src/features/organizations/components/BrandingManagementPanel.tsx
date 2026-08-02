import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ConfirmDialog,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import {
  getOrganizationBranding,
  resetOrganizationBranding,
  saveOrganizationBranding,
} from "../services/branding-service";
import {
  organizationBrandingSchema,
  type OrganizationBrandingInput,
} from "../validation";
import { DEFAULT_THEME, type BrandingTheme } from "../services/branding-theme";
import { buildBrandedEmail } from "../services/branding-email";
import { BrandingPreview } from "./BrandingPreview";
import type { Organization, OrganizationBranding } from "../types";

const EMPTY_FORM: OrganizationBrandingInput = {
  app_name: "",
  tagline: "",
  logo_url: "",
  favicon_url: "",
  primary_color: DEFAULT_THEME.primary_color,
  accent_color: DEFAULT_THEME.accent_color,
  background_color: DEFAULT_THEME.background_color,
  surface_color: DEFAULT_THEME.surface_color,
  foreground_color: DEFAULT_THEME.foreground_color,
  theme_mode: "light",
  email_from_name: "",
  email_reply_to: "",
  email_header_color: DEFAULT_THEME.primary_color,
  email_footer_text: "",
  support_email: "",
  custom_domain: "",
  is_published: "no",
};

function toForm(row: OrganizationBranding | null): OrganizationBrandingInput {
  if (!row) return EMPTY_FORM;
  return {
    app_name: row.app_name,
    tagline: row.tagline,
    logo_url: row.logo_url ?? "",
    favicon_url: row.favicon_url ?? "",
    primary_color: row.primary_color,
    accent_color: row.accent_color,
    background_color: row.background_color,
    surface_color: row.surface_color,
    foreground_color: row.foreground_color,
    theme_mode: row.theme_mode === "dark" ? "dark" : "light",
    email_from_name: row.email_from_name,
    email_reply_to: row.email_reply_to ?? "",
    email_header_color: row.email_header_color,
    email_footer_text: row.email_footer_text,
    support_email: row.support_email ?? "",
    custom_domain: row.custom_domain ?? "",
    is_published: row.is_published ? "yes" : "no",
  };
}

function ColorField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Tenant-scoped white-label management. Every read and write targets the
 * caller's own organisation and is re-checked by row level security, so this
 * page can never alter another tenant's — or the platform's — branding.
 */
export function BrandingManagementPanel({
  organization,
  canManage,
}: {
  organization: Organization;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tenant-branding", "org", organization.id],
    queryFn: () => getOrganizationBranding(organization.id),
  });

  const [form, setForm] = React.useState<OrganizationBrandingInput>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = React.useState(false);
  const loadedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (query.isSuccess && loadedFor.current !== organization.id) {
      loadedFor.current = organization.id;
      setForm(toForm(query.data));
    }
  }, [query.isSuccess, query.data, organization.id]);

  const save = useMutation({
    mutationFn: (input: OrganizationBrandingInput) =>
      saveOrganizationBranding(organization.id, input),
    onSuccess: (row) => {
      notify.success("Branding saved");
      setForm(toForm(row));
      void queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const reset = useMutation({
    mutationFn: () => resetOrganizationBranding(organization.id),
    onSuccess: () => {
      notify.success("Branding reset to the platform default");
      loadedFor.current = null;
      setForm(EMPTY_FORM);
      void queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const set = <K extends keyof OrganizationBrandingInput>(
    key: K,
    value: OrganizationBrandingInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const previewTheme: BrandingTheme = {
    app_name: (form.app_name ?? "").trim() || organization.name,
    tagline: (form.tagline ?? "").trim() || DEFAULT_THEME.tagline,
    logo_url: (form.logo_url ?? "").trim() || null,
    favicon_url: (form.favicon_url ?? "").trim() || null,
    primary_color: form.primary_color,
    accent_color: form.accent_color,
    background_color: form.background_color,
    surface_color: form.surface_color,
    foreground_color: form.foreground_color,
    theme_mode: form.theme_mode,
  };

  const emailPreview = buildBrandedEmail(
    {
      ...(query.data ?? ({} as OrganizationBranding)),
      app_name: previewTheme.app_name,
      logo_url: previewTheme.logo_url,
      email_from_name: (form.email_from_name ?? "").trim(),
      email_header_color: form.email_header_color,
      email_footer_text: (form.email_footer_text ?? "").trim(),
      email_reply_to: (form.email_reply_to ?? "").trim() || null,
      support_email: (form.support_email ?? "").trim() || null,
    } as OrganizationBranding,
    "Your SC-300 practice result is ready",
    "You scored 812 out of 1000 and passed.\n\nOpen your result to review every question, including the domains where you lost the most marks.",
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = organizationBrandingSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      });
      setErrors(next);
      notify.error("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  if (query.isLoading) return <LoadingBlock label="Loading branding…" />;
  if (query.isError) {
    return <ErrorState title="Branding unavailable" description={(query.error as Error).message} />;
  }

  const row = query.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        {!canManage ? (
          <StatusAlert tone="info" title="Read only">
            Only organisation owners and admins can change branding.
          </StatusAlert>
        ) : null}

        <SurfaceCard title="Identity" description="How your workspace is named and pictured.">
          <fieldset disabled={!canManage} className="space-y-4">
            <TextField
              label="Application name"
              id="brand-application-name"
              value={form.app_name ?? ""}
              onChange={(event) => set("app_name", event.target.value)}
              hint={`Shown in place of AskMeExam for members of ${organization.name}.`}
              {...(errors["app_name"] ? { error: errors["app_name"] } : {})}
            />
            <TextField
              label="Tagline"
              id="brand-tagline"
              value={form.tagline ?? ""}
              onChange={(event) => set("tagline", event.target.value)}
              {...(errors["tagline"] ? { error: errors["tagline"] } : {})}
            />
            <TextField
              label="Logo URL"
              id="brand-logo-url"
              value={form.logo_url ?? ""}
              onChange={(event) => set("logo_url", event.target.value)}
              hint="Full https:// URL to a PNG or SVG, ideally 32px tall."
              {...(errors["logo_url"] ? { error: errors["logo_url"] } : {})}
            />
            <TextField
              label="Favicon URL"
              id="brand-favicon-url"
              value={form.favicon_url ?? ""}
              onChange={(event) => set("favicon_url", event.target.value)}
              hint="Square icon, 32×32 or 64×64."
              {...(errors["favicon_url"] ? { error: errors["favicon_url"] } : {})}
            />
          </fieldset>
        </SurfaceCard>

        <SurfaceCard title="Theme" description="Colours applied across the member experience.">
          <fieldset disabled={!canManage} className="space-y-4">
            <SelectField
              label="Theme mode"
              id="brand-theme-mode"
              value={form.theme_mode}
              onValueChange={(value) =>
                set("theme_mode", value as OrganizationBrandingInput["theme_mode"])
              }
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                label="Primary"
                value={form.primary_color}
                {...(errors["primary_color"] ? { error: errors["primary_color"] } : {})}
                onChange={(value) => set("primary_color", value)}
              />
              <ColorField
                label="Accent"
                value={form.accent_color}
                {...(errors["accent_color"] ? { error: errors["accent_color"] } : {})}
                onChange={(value) => set("accent_color", value)}
              />
              <ColorField
                label="Background"
                value={form.background_color}
                {...(errors["background_color"] ? { error: errors["background_color"] } : {})}
                onChange={(value) => set("background_color", value)}
              />
              <ColorField
                label="Surface"
                value={form.surface_color}
                {...(errors["surface_color"] ? { error: errors["surface_color"] } : {})}
                onChange={(value) => set("surface_color", value)}
              />
              <ColorField
                label="Text"
                value={form.foreground_color}
                {...(errors["foreground_color"] ? { error: errors["foreground_color"] } : {})}
                onChange={(value) => set("foreground_color", value)}
              />
            </div>
          </fieldset>
        </SurfaceCard>

        <SurfaceCard
          title="Email branding"
          description="Sender identity and styling for notifications sent to your members."
        >
          <fieldset disabled={!canManage} className="space-y-4">
            <TextField
              label="Sender display name"
              id="brand-sender-display-name"
              value={form.email_from_name ?? ""}
              onChange={(event) => set("email_from_name", event.target.value)}
              hint="Defaults to your application name."
              {...(errors["email_from_name"] ? { error: errors["email_from_name"] } : {})}
            />
            <TextField
              label="Reply-to address"
              id="brand-reply-to-address"
              type="email"
              value={form.email_reply_to ?? ""}
              onChange={(event) => set("email_reply_to", event.target.value)}
              {...(errors["email_reply_to"] ? { error: errors["email_reply_to"] } : {})}
            />
            <TextField
              label="Support address"
              id="brand-support-address"
              type="email"
              value={form.support_email ?? ""}
              onChange={(event) => set("support_email", event.target.value)}
              {...(errors["support_email"] ? { error: errors["support_email"] } : {})}
            />
            <ColorField
              label="Email header colour"
              value={form.email_header_color}
              {...(errors["email_header_color"] ? { error: errors["email_header_color"] } : {})}
              onChange={(value) => set("email_header_color", value)}
            />
            <TextField
              label="Email footer text"
              id="brand-email-footer-text"
              value={form.email_footer_text ?? ""}
              onChange={(event) => set("email_footer_text", event.target.value)}
              hint="Unsubscribe handling is managed for you and is added automatically."
              {...(errors["email_footer_text"] ? { error: errors["email_footer_text"] } : {})}
            />
          </fieldset>
        </SurfaceCard>

        <SurfaceCard
          title="Custom domain"
          description="Serve the branded workspace from your own hostname."
        >
          <fieldset disabled={!canManage} className="space-y-4">
            <TextField
              label="Custom domain"
              id="brand-custom-domain"
              value={form.custom_domain ?? ""}
              onChange={(event) => set("custom_domain", event.target.value)}
              hint="For example exams.acme.com. Changing this restarts verification."
              {...(errors["custom_domain"] ? { error: errors["custom_domain"] } : {})}
            />
            {row?.custom_domain ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.custom_domain}</span>
                  <StatusBadge tone={row.custom_domain_verified ? "success" : "warning"}>
                    {row.custom_domain_verified ? "Verified" : "Pending verification"}
                  </StatusBadge>
                </div>
                {!row.custom_domain_verified ? (
                  <p className="text-xs text-muted-foreground">
                    Add a TXT record at{" "}
                    <code className="rounded bg-background px-1">
                      _askmeexam.{row.custom_domain}
                    </code>{" "}
                    with the value{" "}
                    <code className="rounded bg-background px-1 break-all">
                      {row.custom_domain_verification_token}
                    </code>
                    , then point the hostname at the platform. Verification completes automatically.
                  </p>
                ) : null}
              </div>
            ) : null}
            <SelectField
              label="Publish branding"
              id="brand-is-published"
              value={form.is_published}
              onValueChange={(value) =>
                set("is_published", value as OrganizationBrandingInput["is_published"])
              }
              hint="While unpublished only this preview reflects your changes."
              options={[
                { value: "no", label: "Draft — visible here only" },
                { value: "yes", label: "Published — applied for members" },
              ]}
            />
          </fieldset>
        </SurfaceCard>

        {canManage ? (
          <div className="flex flex-wrap gap-3">
            <PrimaryButton type="submit" loading={save.isPending}>
              Save branding
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => setConfirmReset(true)} disabled={!row}>
              Reset to default
            </SecondaryButton>
          </div>
        ) : null}
      </form>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <SurfaceCard title="Live preview" description="Applied to this panel only.">
          <BrandingPreview theme={previewTheme} />
        </SurfaceCard>

        <SurfaceCard title="Email preview" description={`From: ${emailPreview.fromName}`}>
          <iframe
            title="Branded email preview"
            srcDoc={emailPreview.html}
            sandbox=""
            className="h-80 w-full rounded-md border border-border bg-white"
          />
        </SurfaceCard>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset branding?"
        description="Members of this organisation return to the standard AskMeExam appearance."
        confirmLabel="Reset branding"
        onConfirm={() => {
          setConfirmReset(false);
          reset.mutate();
        }}
        onOpenChange={setConfirmReset}
      />
    </div>
  );
}