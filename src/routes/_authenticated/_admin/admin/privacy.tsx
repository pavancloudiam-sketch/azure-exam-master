import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  DestructiveButton,
  EmptyState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import {
  decideAccountDeletion,
  decideOrganizationDeletion,
  getRetentionPolicy,
  listOpenAccountDeletions,
  listOpenOrganizationDeletions,
  saveRetentionPolicy,
} from "@/features/privacy/services/privacy-service";
import { DELETION_STATUS_TONE } from "@/features/privacy/types";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function PlatformRetentionCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ ai: "180", api: "90", ttl: "72", grace: "30" });
  const policy = useQuery({
    queryKey: ["retention-policy", "platform"],
    queryFn: () => getRetentionPolicy(null),
  });

  React.useEffect(() => {
    if (!policy.data) return;
    setForm({
      ai: String(policy.data.ai_log_retention_days),
      api: String(policy.data.api_log_retention_days),
      ttl: String(policy.data.export_ttl_hours),
      grace: String(policy.data.deletion_grace_days),
    });
  }, [policy.data]);

  const save = useMutation({
    mutationFn: () =>
      saveRetentionPolicy({
        organizationId: null,
        aiLogRetentionDays: Number(form.ai),
        apiLogRetentionDays: Number(form.api),
        exportTtlHours: Number(form.ttl),
        deletionGraceDays: Number(form.grace),
      }),
    onSuccess: () => {
      notify.success("Platform retention settings saved");
      void queryClient.invalidateQueries({ queryKey: ["retention-policy", "platform"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  return (
    <SurfaceCard>
      <h2 className="text-lg font-semibold">Platform retention defaults</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Applied to every organisation that has not set its own values. The scheduled retention job
        purges expired exports and prunes logs using these numbers.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="platform-retention-ai"
          type="number"
          label="AI log retention (days)"
          value={form.ai}
          onChange={(event) => setForm((prev) => ({ ...prev, ai: event.target.value }))}
        />
        <TextField
          id="platform-retention-api"
          type="number"
          label="API log retention (days)"
          value={form.api}
          onChange={(event) => setForm((prev) => ({ ...prev, api: event.target.value }))}
        />
        <TextField
          id="platform-retention-ttl"
          type="number"
          label="Export availability (hours)"
          value={form.ttl}
          onChange={(event) => setForm((prev) => ({ ...prev, ttl: event.target.value }))}
        />
        <TextField
          id="platform-retention-grace"
          type="number"
          label="Deletion grace period (days)"
          value={form.grace}
          onChange={(event) => setForm((prev) => ({ ...prev, grace: event.target.value }))}
        />
      </div>
      <div className="mt-4">
        <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
          Save defaults
        </PrimaryButton>
      </div>
    </SurfaceCard>
  );
}

function AdminPrivacyPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const accounts = useQuery({
    queryKey: ["admin-account-deletions"],
    queryFn: listOpenAccountDeletions,
  });
  const orgs = useQuery({
    queryKey: ["admin-org-deletions"],
    queryFn: listOpenOrganizationDeletions,
  });

  const decideAccount = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      decideAccountDeletion(id, decision, notes[id] ?? ""),
    onSuccess: () => {
      notify.success("Decision recorded");
      void queryClient.invalidateQueries({ queryKey: ["admin-account-deletions"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const decideOrg = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      decideOrganizationDeletion(id, decision, notes[id] ?? ""),
    onSuccess: () => {
      notify.success("Decision recorded");
      void queryClient.invalidateQueries({ queryKey: ["admin-org-deletions"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  return (
    <PageShell
      title="Data rights and retention"
      description="Review deletion requests and set how long AskMeExam keeps operational data. Every decision is written to the audit log."
    >
      <div className="space-y-8">
        <PlatformRetentionCard />

        <SurfaceCard>
          <h2 className="text-lg font-semibold">Account deletion requests</h2>
          {accounts.isLoading ? (
            <LoadingBlock label="Loading requests" />
          ) : (accounts.data ?? []).length === 0 ? (
            <EmptyState title="Nothing to review" description="No open account deletion requests." />
          ) : (
            <ul className="mt-4 space-y-4">
              {(accounts.data ?? []).map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">User {row.user_id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {formatDate(row.requested_at)} · scheduled{" "}
                        {formatDate(row.scheduled_for)}
                      </p>
                      {row.reason ? <p className="mt-1 text-sm">“{row.reason}”</p> : null}
                    </div>
                    <StatusBadge tone={DELETION_STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <TextField
                      id={`account-note-${row.id}`}
                      label="Decision note"
                      value={notes[row.id] ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))
                      }
                    />
                    <SecondaryButton
                      className="self-end"
                      disabled={decideAccount.isPending}
                      onClick={() => decideAccount.mutate({ id: row.id, decision: "rejected" })}
                    >
                      Reject
                    </SecondaryButton>
                    <DestructiveButton
                      className="self-end"
                      disabled={decideAccount.isPending}
                      onClick={() =>
                        decideAccount.mutate({
                          id: row.id,
                          decision: row.status === "approved" ? "completed" : "approved",
                        })
                      }
                    >
                      {row.status === "approved" ? "Complete deletion" : "Approve"}
                    </DestructiveButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-lg font-semibold">Organisation deletion requests</h2>
          {orgs.isLoading ? (
            <LoadingBlock label="Loading requests" />
          ) : (orgs.data ?? []).length === 0 ? (
            <EmptyState
              title="Nothing to review"
              description="No open organisation deletion requests."
            />
          ) : (
            <ul className="mt-4 space-y-4">
              {(orgs.data ?? []).map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Organisation {row.organization_id.slice(0, 8)}…
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested {formatDate(row.requested_at)} · scheduled{" "}
                        {formatDate(row.scheduled_for)}
                      </p>
                      {row.reason ? <p className="mt-1 text-sm">“{row.reason}”</p> : null}
                    </div>
                    <StatusBadge tone={DELETION_STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <TextField
                      id={`org-note-${row.id}`}
                      label="Decision note"
                      value={notes[row.id] ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))
                      }
                    />
                    <SecondaryButton
                      className="self-end"
                      disabled={decideOrg.isPending}
                      onClick={() => decideOrg.mutate({ id: row.id, decision: "rejected" })}
                    >
                      Reject
                    </SecondaryButton>
                    <DestructiveButton
                      className="self-end"
                      disabled={decideOrg.isPending}
                      onClick={() =>
                        decideOrg.mutate({
                          id: row.id,
                          decision: row.status === "approved" ? "completed" : "approved",
                        })
                      }
                    >
                      {row.status === "approved" ? "Complete deletion" : "Approve"}
                    </DestructiveButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/privacy")({
  head: () => ({
    meta: [
      { title: "Data rights and retention — AskMeExam admin" },
      {
        name: "description",
        content: "Review AskMeExam deletion requests and configure data retention policies.",
      },
      { property: "og:title", content: "Data rights and retention — AskMeExam admin" },
      {
        property: "og:description",
        content: "Review AskMeExam deletion requests and configure data retention policies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPrivacyPage,
});