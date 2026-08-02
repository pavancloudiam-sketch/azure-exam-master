import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  StatusBadge,
  SurfaceCard,
  notify,
} from "@/features/shared/components/ui";
import { OrganizationWorkspace } from "@/features/organizations/components/OrganizationWorkspace";
import {
  acceptInvitation,
  listMyMemberships,
} from "@/features/organizations/services/organization-service";
import { ORG_ROLE_LABELS } from "@/features/organizations/types";

function OrganizationPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["my-memberships"], queryFn: listMyMemberships });

  const accept = useMutation({
    mutationFn: (orgId: string) => acceptInvitation(orgId),
    onSuccess: () => {
      notify.success("Invitation accepted");
      void queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const memberships = query.data ?? [];
  const invitations = memberships.filter((m) => m.status === "invited");
  const active = memberships.filter((m) => m.status === "active");

  return (
    <PageShell
      title="My organisation"
      description="Organisations you have been invited to or assigned to. Individual study continues to work whether or not you belong to one."
    >
      {query.isLoading ? (
        <LoadingBlock label="Loading your organisations" />
      ) : query.isError ? (
        <ErrorState
          title="Could not load your organisations"
          description={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      ) : memberships.length === 0 ? (
        <EmptyState
          title="You are not part of an organisation"
          description="You are studying as an individual student. If your employer or training provider invites you, the invitation appears here."
        />
      ) : (
        <div className="space-y-8">
          {invitations.length > 0 ? (
            <SurfaceCard>
              <h2 className="text-lg font-semibold">Pending invitations</h2>
              <ul className="mt-4 divide-y divide-border">
                {invitations.map((m) => (
                  <li
                    key={m.organization.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <span className="font-medium">{m.organization.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {m.roles.map((role) => ORG_ROLE_LABELS[role]).join(", ") || "Member"}
                      </div>
                    </div>
                    <PrimaryButton
                      size="sm"
                      onClick={() => accept.mutate(m.organization.id)}
                      disabled={accept.isPending}
                    >
                      Accept invitation
                    </PrimaryButton>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          ) : null}

          {active.map((m) => (
            <section key={m.organization.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold">{m.organization.name}</h2>
                <StatusBadge tone={m.isOrgAdmin ? "info" : "neutral"}>
                  {m.roles.map((role) => ORG_ROLE_LABELS[role]).join(", ") || "Member"}
                </StatusBadge>
              </div>
              <OrganizationWorkspace organization={m.organization} canManage={m.isOrgAdmin} />
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({
    meta: [
      { title: "My organisation — AskMeExam" },
      {
        name: "description",
        content: "View your AskMeExam organisation membership, invitations and organisation access.",
      },
      { property: "og:title", content: "My organisation — AskMeExam" },
      {
        property: "og:description",
        content: "View your AskMeExam organisation membership, invitations and organisation access.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrganizationPage,
});