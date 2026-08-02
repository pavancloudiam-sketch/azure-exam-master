import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SecondaryButton,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";

import { DOCUMENT_CATEGORY_LABELS, type Document } from "@/features/documents/types";
import { createSignedUrl, listMyDocuments } from "@/features/documents/services/document-service";

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({
    meta: [
      { title: "Resources — AskMeExam" },
      {
        name: "description",
        content: "Study notes, guides and other materials shared with you.",
      },
      { property: "og:title", content: "Resources — AskMeExam" },
      { property: "og:description", content: "Study notes, guides and other materials shared with you." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResourcesPage,
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleDownload(document: Document) {
  try {
    const url = await createSignedUrl(document);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    notify.error(error instanceof Error ? error.message : "Could not generate a download link.");
  }
}

function ResourcesPage() {
  const [search, setSearch] = React.useState("");
  const query = useQuery({ queryKey: ["my-documents"], queryFn: listMyDocuments });

  const documents = (query.data ?? []).filter((document) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      document.title.toLowerCase().includes(term) ||
      (document.description ?? "").toLowerCase().includes(term)
    );
  });

  const grouped = documents.reduce<Record<string, Document[]>>((acc, document) => {
    const key = DOCUMENT_CATEGORY_LABELS[document.category];
    acc[key] = acc[key] ? [...acc[key], document] : [document];
    return acc;
  }, {});

  return (
    <PageShell
      title="Resources"
      description="Study notes, guides and other materials shared with you by the training team."
    >
      <div className="space-y-6">
        <TextField
          id="resources-search"
          label="Search resources"
          placeholder="Search by title or description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {query.isLoading ? (
          <LoadingBlock label="Loading resources" />
        ) : query.isError ? (
          <ErrorState title="Could not load resources" description={(query.error as Error).message} />
        ) : documents.length === 0 ? (
          <EmptyState
            title="No resources shared yet"
            description="Your trainer hasn't shared any documents with you yet. Check back later."
          />
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <SurfaceCard key={category} title={category}>
              <ul className="divide-y divide-border">
                {items.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{document.title}</p>
                      {document.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{document.description}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatBytes(document.size_bytes)} · {new Date(document.created_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <SecondaryButton onClick={() => void handleDownload(document)}>Download</SecondaryButton>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          ))
        )}
      </div>
    </PageShell>
  );
}
