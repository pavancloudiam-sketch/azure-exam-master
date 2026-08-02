import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ConfirmDialog,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
} from "@/features/shared/components/ui";
import { EntityFormModal, type FieldDef } from "@/features/admin/components/EntityFormModal";
import { sendTestWebhook } from "../services/webhooks.functions";
import {
  createApiKey,
  createWebhook,
  getSsoConfiguration,
  listApiKeys,
  listApiRequestLogs,
  listWebhookDeliveries,
  listWebhooks,
  revokeApiKey,
  saveSsoConfiguration,
  setWebhookStatus,
} from "../services/enterprise-service";
import {
  apiKeySchema,
  ssoConfigSchema,
  webhookSchema,
  type ApiKeyInput,
  type SsoConfigInput,
  type WebhookInput,
} from "../validation";
import {
  API_SCOPES,
  SSO_METHODS,
  WEBHOOK_EVENT_TYPES,
  type IssuedApiKey,
  type IssuedWebhook,
} from "../types";
import type { Organization } from "@/features/organizations/types";

const ssoFields: FieldDef[] = [
  {
    name: "method",
    label: "Sign-in method",
    type: "select",
    required: true,
    options: Object.entries(SSO_METHODS).map(([value, label]) => ({ value, label })),
  },
  { name: "display_name", label: "Button label shown to your people", type: "text" },
  {
    name: "email_domains",
    label: "Email domains",
    type: "text",
    hint: "Comma separated, e.g. contoso.com, contoso.co.in",
  },
  {
    name: "metadata_url",
    label: "SAML metadata URL",
    type: "text",
    hint: "Entra ID federation metadata document (SAML only).",
  },
  { name: "issuer_url", label: "OpenID Connect issuer URL", type: "text" },
  { name: "client_id", label: "Client / application ID", type: "text" },
  {
    name: "allowed_redirect_urls",
    label: "Verified redirect URLs",
    type: "text",
    hint: "Comma separated https URLs. Anything not listed here is rejected.",
  },
  {
    name: "is_enforced",
    label: "Require this method",
    type: "select",
    required: true,
    options: [
      { value: "no", label: "No — password sign-in stays available" },
      { value: "yes", label: "Yes — request that members use this method" },
    ],
  },
];

const apiKeyFields: FieldDef[] = [
  { name: "name", label: "Key name", type: "text", required: true },
  {
    name: "scopes",
    label: "Scopes",
    type: "text",
    required: true,
    hint: `Comma separated. Available: ${Object.keys(API_SCOPES).join(", ")}`,
  },
  { name: "rate_limit_per_hour", label: "Requests per hour", type: "text", required: true },
  { name: "expires_in_days", label: "Expires in (days)", type: "text", hint: "Blank for no expiry." },
];

const webhookFields: FieldDef[] = [
  { name: "name", label: "Endpoint name", type: "text", required: true },
  { name: "target_url", label: "HTTPS endpoint URL", type: "text", required: true },
  {
    name: "event_types",
    label: "Events",
    type: "text",
    required: true,
    hint: `Comma separated. Available: ${Object.keys(WEBHOOK_EVENT_TYPES).join(", ")}`,
  },
];

/**
 * Enterprise identity and integration settings for one organisation.
 *
 * Secrets are shown exactly once, at creation time, because only their digest
 * is stored. Everything here is gated on `canManage`, and the server re-checks
 * organisation admin rights on every call.
 */
export function EnterprisePanel({
  organization,
  canManage,
}: {
  organization: Organization;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const orgId = organization.id;
  const [ssoOpen, setSsoOpen] = React.useState(false);
  const [keyOpen, setKeyOpen] = React.useState(false);
  const [hookOpen, setHookOpen] = React.useState(false);
  const [issuedKey, setIssuedKey] = React.useState<IssuedApiKey | null>(null);
  const [issuedHook, setIssuedHook] = React.useState<IssuedWebhook | null>(null);
  const [pendingRevoke, setPendingRevoke] = React.useState<string | null>(null);

  const sso = useQuery({ queryKey: ["org-sso", orgId], queryFn: () => getSsoConfiguration(orgId) });
  const keys = useQuery({ queryKey: ["org-api-keys", orgId], queryFn: () => listApiKeys(orgId) });
  const hooks = useQuery({ queryKey: ["org-webhooks", orgId], queryFn: () => listWebhooks(orgId) });
  const deliveries = useQuery({
    queryKey: ["org-webhook-deliveries", orgId],
    queryFn: () => listWebhookDeliveries(orgId),
  });
  const logs = useQuery({
    queryKey: ["org-api-logs", orgId],
    queryFn: () => listApiRequestLogs(orgId),
  });

  const saveSso = useMutation({
    mutationFn: (values: SsoConfigInput) => saveSsoConfiguration(orgId, values),
    onSuccess: () => {
      notify.success("Sign-in configuration saved");
      void queryClient.invalidateQueries({ queryKey: ["org-sso", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const addKey = useMutation({
    mutationFn: (values: ApiKeyInput) => createApiKey(orgId, values),
    onSuccess: (key) => {
      setIssuedKey(key);
      void queryClient.invalidateQueries({ queryKey: ["org-api-keys", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      notify.success("API key revoked");
      void queryClient.invalidateQueries({ queryKey: ["org-api-keys", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const addHook = useMutation({
    mutationFn: (values: WebhookInput) => createWebhook(orgId, values),
    onSuccess: (hook) => {
      setIssuedHook(hook);
      void queryClient.invalidateQueries({ queryKey: ["org-webhooks", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggleHook = useMutation({
    mutationFn: (input: { id: string; status: "active" | "disabled" }) =>
      setWebhookStatus(input.id, input.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["org-webhooks", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const testHook = useMutation({
    mutationFn: (webhookId: string) => sendTestWebhook({ data: { webhookId } }),
    onSuccess: (result) => {
      if (result.status === "delivered") notify.success("Test event delivered");
      else notify.error(result.error ?? "The endpoint did not accept the test event");
      void queryClient.invalidateQueries({ queryKey: ["org-webhook-deliveries", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["org-webhooks", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  if (!canManage) {
    return (
      <SurfaceCard>
        <h2 className="text-lg font-semibold">Enterprise identity and API</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Only organisation admins can view sign-in configuration, API keys and webhooks.
        </p>
      </SurfaceCard>
    );
  }

  const config = sso.data;

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Sign-in and identity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how people from {organization.name} sign in. Microsoft Entra ID (SAML) and
              generic OpenID Connect are recorded as configuration only in this milestone — they are
              not yet certified against those standards, so treat them as pending verification.
            </p>
          </div>
          <SecondaryButton size="sm" onClick={() => setSsoOpen(true)}>
            Configure sign-in
          </SecondaryButton>
        </div>
        <div className="mt-4 text-sm">
          {sso.isLoading ? (
            <LoadingBlock label="Loading sign-in configuration" />
          ) : config ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-medium">
                  {SSO_METHODS[config.method as keyof typeof SSO_METHODS] ?? config.method}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge tone={config.status === "active" ? "success" : "neutral"}>
                    {config.status.replace("_", " ")}
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email domains</dt>
                <dd className="font-medium">{config.email_domains.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Verified redirect URLs</dt>
                <dd className="font-medium">{config.allowed_redirect_urls.join(", ") || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground">
              No configuration yet — members sign in with email and password, or Google.
            </p>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">API keys</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only keys for the AskMeExam public API. Keys are stored as a one-way hash, so the
              full key is shown once and cannot be recovered later.
            </p>
          </div>
          <PrimaryButton size="sm" onClick={() => setKeyOpen(true)}>
            Create API key
          </PrimaryButton>
        </div>
        {issuedKey ? (
          <StatusAlert tone="success" title="Copy this key now" className="mt-4">
            <code className="break-all font-mono text-xs">{issuedKey.api_key}</code>
            <p className="mt-2 text-xs">
              This is the only time the key is shown. Store it in your own secret manager.
            </p>
            <SecondaryButton size="sm" className="mt-3" onClick={() => setIssuedKey(null)}>
              I have stored it
            </SecondaryButton>
          </StatusAlert>
        ) : null}
        <div className="mt-4 text-sm">
          {keys.isLoading ? (
            <LoadingBlock label="Loading API keys" />
          ) : keys.isError ? (
            <ErrorState
              title="Could not load API keys"
              description={(keys.error as Error).message}
              onRetry={() => void keys.refetch()}
            />
          ) : keys.data && keys.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {keys.data.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <span className="font-medium">{key.name}</span>{" "}
                    <code className="font-mono text-xs text-muted-foreground">
                      {key.key_prefix}.…
                    </code>
                    <div className="text-xs text-muted-foreground">
                      {key.scopes.join(", ")} · {key.rate_limit_per_hour}/hour ·{" "}
                      {key.last_used_at
                        ? `last used ${new Date(key.last_used_at).toLocaleString()}`
                        : "never used"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={key.status === "active" ? "success" : "neutral"}>
                      {key.status}
                    </StatusBadge>
                    {key.status === "active" ? (
                      <SecondaryButton size="sm" onClick={() => setPendingRevoke(key.id)}>
                        Revoke
                      </SecondaryButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No API keys yet.</p>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Webhooks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AskMeExam signs every delivery with your endpoint secret using HMAC SHA-256 in the{" "}
              <code className="font-mono text-xs">x-askmeexam-signature</code> header, and sends an
              idempotency key so repeats are safe to ignore.
            </p>
          </div>
          <PrimaryButton size="sm" onClick={() => setHookOpen(true)}>
            Add endpoint
          </PrimaryButton>
        </div>
        {issuedHook ? (
          <StatusAlert tone="success" title="Copy this signing secret now" className="mt-4">
            <code className="break-all font-mono text-xs">{issuedHook.signing_secret}</code>
            <SecondaryButton size="sm" className="mt-3" onClick={() => setIssuedHook(null)}>
              I have stored it
            </SecondaryButton>
          </StatusAlert>
        ) : null}
        <div className="mt-4 text-sm">
          {hooks.isLoading ? (
            <LoadingBlock label="Loading webhook endpoints" />
          ) : hooks.data && hooks.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {hooks.data.map((hook) => (
                <li key={hook.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <span className="font-medium">{hook.name}</span>
                    <div className="break-all text-xs text-muted-foreground">{hook.target_url}</div>
                    <div className="text-xs text-muted-foreground">
                      {hook.event_types.join(", ")} · secret {hook.secret_fingerprint} ·{" "}
                      {hook.last_delivery_at
                        ? `last delivery ${hook.last_delivery_status}`
                        : "no deliveries yet"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={hook.status === "active" ? "success" : "neutral"}>
                      {hook.status}
                    </StatusBadge>
                    <SecondaryButton
                      size="sm"
                      onClick={() => testHook.mutate(hook.id)}
                      disabled={testHook.isPending || hook.status !== "active"}
                    >
                      Send test event
                    </SecondaryButton>
                    <SecondaryButton
                      size="sm"
                      onClick={() =>
                        toggleHook.mutate({
                          id: hook.id,
                          status: hook.status === "active" ? "disabled" : "active",
                        })
                      }
                    >
                      {hook.status === "active" ? "Disable" : "Enable"}
                    </SecondaryButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No webhook endpoints yet.</p>
          )}
        </div>

        <h3 className="mt-6 text-sm font-semibold">Recent deliveries</h3>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {(deliveries.data ?? []).slice(0, 5).map((delivery) => (
            <li key={delivery.id}>
              {new Date(delivery.created_at).toLocaleString()} — {delivery.status}
              {delivery.response_status ? ` (HTTP ${delivery.response_status})` : ""}
            </li>
          ))}
          {(deliveries.data ?? []).length === 0 ? <li>No deliveries recorded.</li> : null}
        </ul>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-lg font-semibold">API activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every public API call made with this organisation&apos;s keys, including rejected ones.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {(logs.data ?? []).map((entry) => (
            <li key={entry.id}>
              {new Date(entry.created_at).toLocaleString()} — {entry.method} {entry.path} →{" "}
              {entry.status_code} ({entry.outcome})
            </li>
          ))}
          {(logs.data ?? []).length === 0 ? <li>No API calls recorded yet.</li> : null}
        </ul>
      </SurfaceCard>

      <EntityFormModal
        open={ssoOpen}
        onOpenChange={setSsoOpen}
        title="Organisation sign-in"
        description="Identity settings apply to this organisation only."
        fields={ssoFields}
        schema={ssoConfigSchema}
        initialValues={{
          method: config?.method ?? "password",
          display_name: config?.display_name ?? "",
          email_domains: (config?.email_domains ?? []).join(", "),
          metadata_url: config?.metadata_url ?? "",
          issuer_url: config?.issuer_url ?? "",
          client_id: config?.client_id ?? "",
          allowed_redirect_urls: (config?.allowed_redirect_urls ?? []).join(", "),
          is_enforced: config?.is_enforced ? "yes" : "no",
        }}
        submitLabel="Save configuration"
        onSubmit={async (values) => {
          await saveSso.mutateAsync(values as SsoConfigInput);
        }}
      />

      <EntityFormModal
        open={keyOpen}
        onOpenChange={setKeyOpen}
        title="Create an API key"
        description="Read-only scopes only. The key is shown once."
        fields={apiKeyFields}
        schema={apiKeySchema}
        initialValues={{
          name: "",
          scopes: "org:read, members:read",
          rate_limit_per_hour: "1000",
          expires_in_days: "",
        }}
        submitLabel="Create key"
        onSubmit={async (values) => {
          await addKey.mutateAsync(values as ApiKeyInput);
        }}
      />

      <EntityFormModal
        open={hookOpen}
        onOpenChange={setHookOpen}
        title="Add a webhook endpoint"
        description="Only https endpoints are accepted."
        fields={webhookFields}
        schema={webhookSchema}
        initialValues={{ name: "", target_url: "", event_types: "member.joined" }}
        submitLabel="Add endpoint"
        onSubmit={async (values) => {
          await addHook.mutateAsync(values as WebhookInput);
        }}
      />

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revoke this API key?"
        description="Any integration using it stops working immediately. Revocation cannot be undone — issue a new key instead."
        confirmLabel="Revoke key"
        tone="destructive"
        onConfirm={() => {
          if (pendingRevoke) revoke.mutate(pendingRevoke);
          setPendingRevoke(null);
        }}
      />
    </div>
  );
}