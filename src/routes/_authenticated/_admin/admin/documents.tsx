import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import { ErrorState, LoadingBlock, PrimaryButton } from "@/features/shared/components/ui";

import { DocumentFilters, type DocumentFilterState } from "@/features/documents/components/DocumentFilters";
import { DocumentTable } from "@/features/documents/components/DocumentTable";
import { DocumentUploadDialog } from "@/features/documents/components/DocumentUploadDialog";
import { FolderManager } from "@/features/documents/components/FolderManager";
import { listDocuments, listFolders } from "@/features/documents/services/document-service";
import type { Document } from "@/features/documents/types";

export const Route = createFileRoute("/_authenticated/_admin/admin/documents")({
  head: () => ({
    meta: [
      { title: "Document library — AskMeExam admin" },
      {
        name: "description",
        content: "Upload, organise and share study documents with trainers and students.",
      },
      { property: "og:title", content: "Document library — AskMeExam admin" },
      {
        property: "og:description",
        content: "Upload, organise and share study documents with trainers and students.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDocumentsPage,
});

function AdminDocumentsPage() {
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<DocumentFilterState>({
    search: "",
    category: "all",
    visibility: "all",
    certificationId: "all",
    includeArchived: false,
  });
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Document | null>(null);

  const foldersQuery = useQuery({ queryKey: ["document-folders", true], queryFn: () => listFolders(true) });
  const documentsQuery = useQuery({
    queryKey: ["documents", folderId, filters],
    queryFn: () =>
      listDocuments({
        folderId,
        search: filters.search,
        category: filters.category,
        visibility: filters.visibility,
        certificationId: filters.certificationId,
        includeArchived: filters.includeArchived,
      }),
  });

  return (
    <PageShell
      title="Document library"
      description="Upload study notes, guides and other materials, and control who can see them."
      actions={
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setUploadOpen(true);
          }}
        >
          Upload document
        </PrimaryButton>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {foldersQuery.isLoading ? (
          <LoadingBlock label="Loading folders" />
        ) : foldersQuery.isError ? (
          <ErrorState
            title="Could not load folders"
            description={(foldersQuery.error as Error).message}
            onRetry={() => void queryClient.invalidateQueries({ queryKey: ["document-folders"] })}
          />
        ) : (
          <FolderManager
            folders={foldersQuery.data ?? []}
            selectedFolderId={folderId}
            onSelectFolder={setFolderId}
          />
        )}

        <div className="space-y-4">
          <DocumentFilters value={filters} onChange={setFilters} />

          {documentsQuery.isLoading ? (
            <LoadingBlock label="Loading documents" />
          ) : documentsQuery.isError ? (
            <ErrorState
              title="Could not load documents"
              description={(documentsQuery.error as Error).message}
              onRetry={() => void queryClient.invalidateQueries({ queryKey: ["documents"] })}
            />
          ) : (
            <DocumentTable
              documents={documentsQuery.data ?? []}
              onEdit={(document) => {
                setEditing(document);
                setUploadOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setEditing(null);
        }}
        folders={foldersQuery.data ?? []}
        editing={editing}
      />
    </PageShell>
  );
}
