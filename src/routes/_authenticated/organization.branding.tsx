import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  SelectField,
} from "@/features/shared/components/ui";
import { BrandingManagementPanel } from "@/features/organizations/components/BrandingManagementPanel";
import { listMyMemberships } from "@/features/organizations/services/organization-service";

function BrandingPage() {
  const query = useQuery({ queryKey: ["my-memberships"], queryFn: listMyMemberships });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const memberships = (query.data ?? []).filter((m) => m.status === "active");
  const active = memberships.find((m) => m.organization.id === selectedId) ?? memberships[0];

  return (
    <PageShell
      title="Branding"
      description="White-label the workspace your members see, without changing anything for other organisations."
    >
      {query.isLoading ? <LoadingBlock label="Loading organisations…" /> : null}
      {query.isError ? (
        <ErrorState
          title="Could not load organisations"
          description={(query.error as Error).message}
        />
      ) : null}

      {query.isSuccess && !active ? (
        <EmptyState
          title="No organisation yet"
          description="Branding becomes available once you belong to an active organisation."
        />
      ) : null}

      {active ? (
        <div className="space-y-6">
          {memberships.length > 1 ? (
            <div className="max-w-sm">
              <SelectField
                id="branding-organisation"
                label="Organisation"
                value={active.organization.id}
                onValueChange={setSelectedId}
                options={memberships.map((m) => ({
                  value: m.organization.id,
                  label: m.organization.name,
                }))}
              />
            </div>
          ) : null}
          <BrandingManagementPanel
            organization={active.organization}
            canManage={active.isOrgAdmin}
          />
        </div>
      ) : null}
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/organization/branding")({
  component: BrandingPage,
  head: () => ({
    meta: [
      { title: "Organisation branding — AskMeExam" },
      {
        name: "description",
        content:
          "Configure per-tenant logo, colours, favicon, application name, email branding and custom domain for your AskMeExam organisation.",
      },
      { property: "og:title", content: "Organisation branding — AskMeExam" },
      {
        property: "og:description",
        content: "White-label your AskMeExam workspace with tenant-specific themes and branding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/organization/branding" }],
  }),
});
