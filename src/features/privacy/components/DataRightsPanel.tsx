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
  cancelAccountDeletion,
  createMyExport,
  downloadExport,
  getMyConsents,
  getMyDeletionRequest,
  listMyExports,
  requestAccountDeletion,
  saveJsonFile,
} from "../services/privacy-service";
import { DELETION_STATUS_TONE } from "../types";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataRightsPanel() {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");

  const exports = useQuery({ queryKey: ["my-exports"], queryFn: listMyExports });
  const consents = useQuery({ queryKey: ["my-consents"], queryFn: getMyConsents });
  const deletion = useQuery({ queryKey: ["my-deletion"], queryFn: getMyDeletionRequest });

  const create = useMutation({
    mutationFn: createMyExport,
    onSuccess: () => {
      notify.success("Your data export is ready to download");
      void queryClient.invalidateQueries({ queryKey: ["my-exports"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const download = useMutation({
    mutationFn: async (id: string) => {
      const payload = await downloadExport(id);
      saveJsonFile(`askmeexam-my-data-${id.slice(0, 8)}.json`, payload);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-exports"] }),
    onError: (error: Error) => notify.error(error.message),
  });

  const requestDeletion = useMutation({
    mutationFn: () => requestAccountDeletion(reason),
    onSuccess: () => {
      notify.success("Deletion request submitted");
      setDeleteOpen(false);
      setReason("");
      setConfirmText("");
      void queryClient.invalidateQueries({ queryKey: ["my-deletion"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const cancelDeletion = useMutation({
    mutationFn: cancelAccountDeletion,
    onSuccess: () => {
      notify.success("Deletion request cancelled — your account stays active");
      void queryClient.invalidateQueries({ queryKey: ["my-deletion"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const open = deletion.data && ["pending", "approved"].includes(deletion.data.status);

  return (
    <div className="space-y-8">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Download your data</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A machine-readable copy of your profile, attempts and answers, purchases, receipts,
              access, consents and AI activity. Exam questions, answer keys and explanations are
              AskMeExam content and are not part of a personal export.
            </p>
          </div>
          <PrimaryButton onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Preparing…" : "Request export"}
          </PrimaryButton>
        </div>

        <div className="mt-5">
          {exports.isLoading ? (
            <LoadingBlock label="Loading your exports" />
          ) : (exports.data ?? []).length === 0 ? (
            <EmptyState
              title="No exports yet"
              description="Request an export and it appears here, ready to download."
            />
          ) : (
            <ul className="divide-y divide-border">
              {(exports.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{formatDate(row.requested_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(row.byte_size)} · {row.download_count} download
                      {row.download_count === 1 ? "" : "s"} ·{" "}
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
        <h2 className="text-lg font-semibold">Your consents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each version of our terms, privacy policy and refund policy you have accepted, with the
          exact time it was recorded.
        </p>
        {consents.isLoading ? (
          <LoadingBlock label="Loading your consents" />
        ) : (consents.data ?? []).length === 0 ? (
          <EmptyState title="No consent records" description="Nothing has been recorded yet." />
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {(consents.data ?? []).map((row) => (
              <li
                key={`${row.doc_type}-${row.version}-${row.accepted_at}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="font-medium capitalize">
                  {row.doc_type.replaceAll("_", " ")} v{row.version}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.context} · {formatDate(row.accepted_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-lg font-semibold">Delete your account</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Deletion is reviewed by our team and runs after a grace period, so you can change your
          mind. Your profile is anonymised and organisation memberships and access are removed.
          Orders, receipts and refunds are kept because Indian tax and consumer-protection rules
          require them — they are unlinked from your name and email address.
        </p>

        {deletion.isLoading ? (
          <LoadingBlock label="Checking your account status" />
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
              Keep my account
            </SecondaryButton>
          </div>
        ) : (
          <div className="mt-4">
            <DestructiveButton onClick={() => setDeleteOpen(true)}>
              <ShieldAlert aria-hidden="true" /> Request account deletion
            </DestructiveButton>
          </div>
        )}
      </SurfaceCard>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Request account deletion"
        description="Download your data first if you want to keep a copy. Type DELETE to confirm."
      >
        <div className="space-y-4">
          <TextField
            id="deletion-reason"
            label="Why are you leaving? (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <TextField
            id="deletion-confirm"
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