import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  ConfirmDialog,
  DataTable,
  DestructiveButton,
  SecondaryButton,
  StatusBadge,
  notify,
  type Column,
} from "@/features/shared/components/ui";

import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_VISIBILITY_LABELS, type Document } from "../types";
import {
  archiveDocument,
  createSignedUrl,
  deleteDocument,
  restoreDocument,
} from "../services/document-service";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function visibilityTone(visibility: Document["visibility"]) {
  if (visibility === "admin_only") return "error" as const;
  if (visibility === "trainer") return "warning" as const;
  if (visibility === "exam_assigned") return "info" as const;
  return "success" as const;
}

export function DocumentTable({
  documents,
  onEdit,
}: {
  documents: Document[];
  onEdit: (document: Document) => void;
}) {
  const queryClient = useQueryClient();
  const [pendingArchive, setPendingArchive] = React.useState<Document | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Document | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["documents"] });

  const archiveMutation = useMutation({
    mutationFn: (document: Document) =>
      document.archived ? restoreDocument(document) : archiveDocument(document),
    onSuccess: (_data, document) => {
      notify.success(document.archived ? "Document restored." : "Document archived.");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (document: Document) => deleteDocument(document),
    onSuccess: () => {
      notify.success("Document deleted.");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  async function handleDownload(document: Document) {
    try {
      const url = await createSignedUrl(document);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not generate a download link.");
    }
  }

  const columns: Column<Document>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.original_filename}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => DOCUMENT_CATEGORY_LABELS[row.category],
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (row) => (
        <StatusBadge tone={visibilityTone(row.visibility)}>
          {DOCUMENT_VISIBILITY_LABELS[row.visibility]}
        </StatusBadge>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (row) => formatBytes(row.size_bytes),
    },
    {
      key: "uploaded",
      header: "Uploaded",
      render: (row) => new Date(row.created_at).toLocaleDateString("en-GB"),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.archived ? <StatusBadge tone="warning">Archived</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <SecondaryButton size="sm" onClick={() => void handleDownload(row)}>
            Download
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => onEdit(row)}>
            Edit
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingArchive(row)}>
            {row.archived ? "Restore" : "Archive"}
          </SecondaryButton>
          <DestructiveButton size="sm" onClick={() => setPendingDelete(row)}>
            Delete
          </DestructiveButton>
        </div>
      ),
      className: "min-w-[280px]",
    },
  ];

  return (
    <>
      <DataTable
        caption="Documents"
        columns={columns}
        rows={documents}
        getRowId={(row) => row.id}
        emptyMessage="No documents match your filters."
      />

      <ConfirmDialog
        open={Boolean(pendingArchive)}
        onOpenChange={(open) => !open && setPendingArchive(null)}
        title={pendingArchive?.archived ? "Restore document?" : "Archive document?"}
        description={
          pendingArchive?.archived
            ? "This document will become visible again to anyone with access."
            : "This document will be hidden from students and trainers until restored."
        }
        confirmLabel={pendingArchive?.archived ? "Restore" : "Archive"}
        onConfirm={() => {
          if (pendingArchive) archiveMutation.mutate(pendingArchive);
          setPendingArchive(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete document?"
        description="This permanently removes the file and its record. This cannot be undone."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
