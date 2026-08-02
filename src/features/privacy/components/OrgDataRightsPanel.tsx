import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ShieldAlert } from "lucide-react";

import {
  DestructiveButton,
  EmptyState,
  LoadingBlock,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import {
  cancelOrganizationDeletion,
  createOrganizationExport,
  downloadExport,
  getOrganizationDeletionRequest,
  getRetentionPolicy,
  listOrganizationExports,
  requestOrganizationDeletion,
  saveJsonFile,
  saveRetentionPolicy,
} from "../services/privacy-service";
import { DELETION_STATUS_TONE } from "../types";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

type Props = { organizationId: string; organizationName: string; canManage: boolean };

export function OrgDataRightsPanel({ organizationId, organizationName, canManage }: Props) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [form, setForm] = React.useState({ ai: "180", api: "90", ttl: "72", grace: "30" });

  const exports = useQuery({
    queryKey: ["org-exports", organizationId],
    queryFn: () => listOrganizationExports(organizationId),
  });
  const deletion = useQuery({
    queryKey: ["org-deletion", organizationId],
    queryFn: () => getOrganizationDeletionRequest(organizationId),
  });
  const policy = useQuery({
    queryKey: ["retention-policy", organizationId],
    queryFn: () => getRetentionPolicy(organizationId),
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

  const create = useMutation({
    mutationFn: () => createOrganizationExport(organizationId),
    onSuccess: () => {
      notify.success("Organisation export ready");
      void queryClient.invalidateQueries({ queryKey: ["org-exports", organizationId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const download = useMutation({
    mutationFn: async (id: string) => {
      const payload = await downloadExport(id);
      saveJsonFile(`askmeexam-organisation-${id.slice(0, 8)}.json`, payload);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["org-exports", organizationId] }),
    onError: (error: Error) => notify.error(error.message),
  });

  const savePolicy = useMutation({
    mutationFn: () =>
      saveRetentionPolicy({
        organizationId,
        aiLogRetentionDays: Number(form.ai),
        apiLogRetentionDays: Number(form.api),
        exportTtlHours: Number(form.ttl),
        deletionGraceDays: Number(form.grace),
      }),
    onSuccess: () => {
      notify.success("Retention settings saved");
      void queryClient.invalidateQueries({ queryKey: ["retention-policy", organizationId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const requestDeletion = useMutation({
    mutationFn: () => requestOrganizationDeletion(organizationId, reason),
    onSuccess: () => {
      notify.success("Organisation deletion request submitted for review");
      setDeleteOpen(false);
      setReason("");
      setConfirmText("");
      void queryClient.invalidateQueries({ queryKey: ["org-deletion", organizationId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const cancelDeletion = useMutation({
    mutationFn: () => cancelOrganizationDeletion(organizationId),
    onSuccess: () => {
      notify.success("Deletion request cancelled");
      void queryClient.invalidateQueries({ queryKey: ["org-deletion", organizationId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const open = deletion.data && ["pending", "approved"].includes(deletion.data.status);

  if (!canManage) {
    return (
      <SurfaceCard>
        <h3 className="text-base font-semibold">Data rights</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Exports, retention settings and deletion for {organizationName} are managed by your
          organisation owners and admins. Your own personal data export lives in your privacy
          settings.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Organisation data export</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Members, roles, settings, organisation access, API key metadata, webhook endpoints and
              tenant audit logs. Secrets, key hashes and members' personal exam answers are never
              included.
            </p>
          </div>
          <PrimaryButton onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Preparing…" : "Request export"}
          </PrimaryButton>
        </div>
        <div className="mt-5">
          {exports.isLoading ? (
            <LoadingBlock label="Loading exports" />
          ) : (exports.data ?? []).length === 0 ? (
            <EmptyState title="No exports yet" description="Request one to download tenant data." />
          ) : (
            <ul className="divide-y divide-border">
              {(exports.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{formatDate(row.requested_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.status === "ready"
                        ? `available until ${formatDate(row.expires_at)}`
                        : "expired"}
                    </p>
                  </div>
                  <SecondaryButton
                    size="sm"
                    disabled={row.status !== "ready" || download.isPending}
                    onClick={() => download.mutate(row.id)}
                  >
                    <Download aria-hidden="true" /> Download JSON
                  </SecondaryButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h3 className="text-base font-semibold">Retention controls</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          How long this organisation keeps operational logs and exports. Exam attempts and financial
          records follow the platform policy and are not shortened here.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="retention-ai"
            type="number"
            label="AI log retention (days)"
            value={form.ai}
            onChange={(event) => setForm((prev) => ({ ...prev, ai: event.target.value }))}
          />
          <TextField
            id="retention-api"
            type="number"
            label="API log retention (days)"
            value={form.api}
            onChange={(event) => setForm((prev) => ({ ...prev, api: event.target.value }))}
          />
          <TextField
            id="retention-ttl"
            type="number"
            label="Export availability (hours)"
            value={form.ttl}
            onChange={(event) => setForm((prev) => ({ ...prev, ttl: event.target.value }))}
          />
          <TextField
            id="retention-grace"
            type="number"
            label="Deletion grace period (days)"
            value={form.grace}
            onChange={(event) => setForm((prev) => ({ ...prev, grace: event.target.value }))}
          />
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
            Save retention settings
          </PrimaryButton>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h3 className="text-base font-semibold">Delete this organisation</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Reviewed by AskMeExam and applied after the grace period. Members keep their individual
          accounts, attempts and results; organisation access, API keys, webhooks and SSO settings
          are removed.
        </p>
        {deletion.isLoading ? (
          <LoadingBlock label="Checking status" />
        ) : open && deletion.data ? (
          <div className="mt-4 space-y-3">
            <StatusAlert tone="warning" title="Deletion request in progress">
              Requested {formatDate(deletion.data.requested_at)} · scheduled for{" "}
              {formatDate(deletion.data.scheduled_for)}. Status{" "}
              <StatusBadge tone={DELETION_STATUS_TONE[deletion.data.status]}>
                {deletion.data.status}
              </StatusBadge>
            </StatusAlert>
            <SecondaryButton
              onClick={() => cancelDeletion.mutate()}
              disabled={cancelDeletion.isPending}
            >
              Keep this organisation
            </SecondaryButton>
          </div>
        ) : (
          <div className="mt-4">
            <DestructiveButton onClick={() => setDeleteOpen(true)}>
              <ShieldAlert aria-hidden="true" /> Request organisation deletion
            </DestructiveButton>
          </div>
        )}
      </SurfaceCard>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${organizationName}`}
        description="Export your organisation data first if you need a copy. Type DELETE to confirm."
      >
        <div className="space-y-4">
          <TextField
            id="org-deletion-reason"
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <TextField
            id="org-deletion-confirm"
            label="Type DELETE to confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            required
          />
          <div className="flex flex-wrap justify-end gap-3">
            <SecondaryButton onClick={() => setDeleteOpen(false)}>Cancel</SecondaryButton>
            <DestructiveButton
              disabled={confirmText !== "DELETE" || requestDeletion.isPending}
              onClick={() => requestDeletion.mutate()}
            >
              Request deletion
            </DestructiveButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}