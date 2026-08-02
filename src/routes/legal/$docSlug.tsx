import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ErrorState,
  SkeletonList,
  StatusAlert,
  SurfaceCard,
} from "@/features/shared/components/ui";
import {
  getCurrentLegalDocument,
  LEGAL_LABELS,
  LEGAL_SLUGS,
} from "@/features/legal/services/legal-service";

export const Route = createFileRoute("/legal/$docSlug")({
  beforeLoad: ({ params }) => {
    if (!LEGAL_SLUGS[params.docSlug]) throw notFound();
  },
  head: ({ params }) => {
    const docType = LEGAL_SLUGS[params.docSlug];
    const label = docType ? LEGAL_LABELS[docType] : "Legal";
    return {
      meta: [
        { title: `${label} — AskMeExam` },
        {
          name: "description",
          content: `The current AskMeExam ${label.toLowerCase()} draft for the India launch. Placeholder text pending professional review.`,
        },
        { property: "og:title", content: `${label} — AskMeExam` },
        {
          property: "og:description",
          content: `AskMeExam ${label.toLowerCase()} — placeholder draft pending professional review.`,
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: LegalDocPage,
});

function LegalDocPage() {
  const { docSlug } = Route.useParams();
  const docType = LEGAL_SLUGS[docSlug]!;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["legal-document", docType],
    queryFn: () => getCurrentLegalDocument(docType),
  });

  return (
    <PageShell
      title={LEGAL_LABELS[docType]}
      description="This page shows the version currently in force for AskMeExam accounts."
    >
      <nav aria-label="Legal documents" className="mb-6 flex flex-wrap gap-3 text-sm">
        {Object.entries(LEGAL_SLUGS).map(([slug, type]) => (
          <Link
            key={slug}
            to="/legal/$docSlug"
            params={{ docSlug: slug }}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-primary"
            activeProps={{ className: "bg-surface text-primary" }}
          >
            {LEGAL_LABELS[type]}
          </Link>
        ))}
      </nav>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState
          title="Could not load this document"
          description="Please try again in a moment."
          onRetry={() => void refetch()}
        />
      ) : !data ? (
        <StatusAlert tone="warning" title="Not published yet">
          No current version of this document has been published.
        </StatusAlert>
      ) : (
        <>
          {data.is_placeholder ? (
            <StatusAlert tone="warning" title="Placeholder draft — not legal advice">
              This text is a structural placeholder so that acceptance can be captured and
              versioned. It has not been reviewed by a qualified professional, it is not legal
              advice, and it does not satisfy any legal or regulatory requirement. It must be
              replaced before any commercial launch.
            </StatusAlert>
          ) : null}
          <SurfaceCard className="mt-6">
            <h2 className="text-lg font-semibold">{data.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Version {data.version} ·{" "}
              {data.effective_at
                ? `effective ${new Date(data.effective_at).toLocaleDateString()}`
                : "no effective date set"}
            </p>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {data.body}
            </div>
          </SurfaceCard>
        </>
      )}
    </PageShell>
  );
}