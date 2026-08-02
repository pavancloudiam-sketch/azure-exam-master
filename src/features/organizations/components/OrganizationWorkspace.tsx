import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ConfirmDialog,
  DataTable,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import { EntityFormModal, type FieldDef } from "@/features/admin/components/EntityFormModal";
import { EnterprisePanel } from "@/features/enterprise/components/EnterprisePanel";
import { OrgDataRightsPanel } from "@/features/privacy/components/OrgDataRightsPanel";
import {
  getOrganizationSettings,
  inviteMember,
  listOrganizationAuditLogs,
  listOrganizationEntitlements,
  listOrganizationMembers,
  removeMember,
  updateOrganizationSettings,
} from "../services/organization-service";
import {
  inviteMemberSchema,
  organizationSettingsSchema,
  type InviteMemberInput,
  type OrganizationSettingsInput,
} from "../validation";
import { ORG_ROLE_LABELS, type MemberWithProfile, type Organization } from "../types";

const inviteFields: FieldDef[] = [
  {
    name: "email",
    label: "Member email",
    type: "text",
    required: true,
    hint: "The person must already have an AskMeExam account.",
  },
  {
    name: "role",
    label: "Organisation role",
    type: "select",
    required: true,
    options: [
      { value: "member", label: "Member — takes exams" },
      { value: "manager", label: "Manager — views organisation progress" },
      { value: "admin", label: "Organisation admin — manages this organisation" },
      { value: "owner", label: "Owner — full control of this organisation" },
    ],
  },
];

const settingsFields: FieldDef[] = [
  { name: "timezone", label: "Timezone", type: "text", required: true },
  { name: "seat_limit", label: "Seat limit", type: "text", hint: "Leave blank for unlimited." },
  {
    name: "allow_domain_join",
    label: "Allow email-domain self join",
    type: "select",
    required: true,
    options: [
      { value: "no", label: "No — invitation or assignment only (recommended)" },
      { value: "yes", label: "Yes — allow matching email domains to join" },
    ],
  },
  {
    name: "allowed_email_domains",
    label: "Allowed email domains",
    type: "text",
    hint: "Comma separated, for example contoso.com, contoso.in",
  },
];

function memberTone(status: MemberWithProfile["status"]) {
  if (status === "active") return "success" as const;
  if (status === "invited") return "info" as const;
  return "neutral" as const;
}

/**
 * Shared organisation workspace. `canManage` only controls what is offered in
 * the UI — every write goes through a server routine that re-checks the
 * caller's organisation role, and every read is filtered by row level security.
 */
export function OrganizationWorkspace({
  organization,
  canManage,
}: {
  organization: Organization;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const orgId = organization.id;
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<MemberWithProfile | null>(null);

  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => listOrganizationMembers(orgId),
  });
  const settings = useQuery({
    queryKey: ["org-settings", orgId],
    queryFn: () => getOrganizationSettings(orgId),
  });
  const entitlements = useQuery({
    queryKey: ["org-entitlements", orgId],
    queryFn: () => listOrganizationEntitlements(orgId),
  });
  const auditLogs = useQuery({
    queryKey: ["org-audit", orgId],
    queryFn: () => listOrganizationAuditLogs(orgId),
    enabled: canManage,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    void queryClient.invalidateQueries({ queryKey: ["org-audit", orgId] });
  };

  const invite = useMutation({
    mutationFn: (input: InviteMemberInput) => inviteMember(orgId, input),
    onSuccess: () => {
      notify.success("Invitation recorded");
      refresh();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (member: MemberWithProfile) => removeMember(orgId, member.user_id),
    onSuccess: () => {
      notify.success("Member removed from this organisation");
      refresh();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const saveSettings = useMutation({
    mutationFn: (input: OrganizationSettingsInput) => updateOrganizationSettings(orgId, input),
    onSuccess: () => {
      notify.success("Settings saved");
      void queryClient.invalidateQueries({ queryKey: ["org-settings", orgId] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const columns: Column<MemberWithProfile>[] = [
    {
      key: "person",
      header: "Member",
      render: (row) => (
        <div>
          <span className="font-medium">{row.full_name ?? "Unnamed student"}</span>
          <div className="text-xs text-muted-foreground">{row.email ?? row.user_id}</div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.length ? (
            row.roles.map((role) => (
              <StatusBadge key={role} tone="info">
                {ORG_ROLE_LABELS[role]}
              </StatusBadge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No role</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge tone={memberTone(row.status)}>{row.status}</StatusBadge>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            className: "text-right",
            render: (row: MemberWithProfile) =>
              row.status === "removed" ? null : (
                <SecondaryButton size="sm" onClick={() => setPendingRemove(row)}>
                  Remove
                </SecondaryButton>
              ),
          } as Column<MemberWithProfile>,
        ]
      : []),
  ];

  const current = settings.data;

  return (
    <div className="space-y-6">
      <StatusAlert tone="info" title="Tenant isolation is enforced in the database">
        Members, settings, entitlements and audit entries are scoped to{" "}
        <strong>{organization.name}</strong> by row level security and server-side authorisation.
        Changing an identifier in the browser cannot reveal another organisation's data.
      </StatusAlert>

      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Members</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Students belong to this organisation only when invited or assigned by an
              administrator.
            </p>
          </div>
          {canManage ? (
            <PrimaryButton onClick={() => setInviteOpen(true)}>Invite member</PrimaryButton>
          ) : null}
        </div>
        <div className="mt-4">
          {members.isLoading ? (
            <LoadingBlock label="Loading members" />
          ) : members.isError ? (
            <ErrorState
              title="Could not load members"
              description={(members.error as Error).message}
              onRetry={() => void members.refetch()}
            />
          ) : (
            <DataTable
              caption="Organisation members"
              columns={columns}
              rows={members.data ?? []}
              getRowId={(row) => row.id}
              emptyMessage="No members yet."
            />
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organisation preferences. Sign-in configuration lives in the sign-in and identity
              section below; white labelling is not part of this release.
            </p>
          </div>
          {canManage ? (
            <SecondaryButton onClick={() => setSettingsOpen(true)}>Edit settings</SecondaryButton>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="font-medium">{current?.timezone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seat limit</dt>
            <dd className="font-medium">{current?.seat_limit ?? "Unlimited"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email-domain self join</dt>
            <dd className="font-medium">{current?.allow_domain_join ? "Allowed" : "Off"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Allowed domains</dt>
            <dd className="font-medium">
              {current?.allowed_email_domains?.length
                ? current.allowed_email_domains.join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-lg font-semibold">Organisation access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Access granted to every active member of this organisation, in addition to any access a
          student bought individually.
        </p>
        <div className="mt-4 text-sm">
          {entitlements.data && entitlements.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {entitlements.data.map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">
                    {row.access_scope === "all" ? "All content" : `Scope: ${row.access_scope}`}
                  </span>
                  <StatusBadge tone={row.status === "active" ? "success" : "neutral"}>
                    {row.status}
                  </StatusBadge>
                  <span className="text-muted-foreground">
                    {row.expires_at
                      ? `Until ${new Date(row.expires_at).toLocaleDateString()}`
                      : "No expiry"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No organisation-level access has been granted yet.
            </p>
          )}
        </div>
      </SurfaceCard>

      {canManage ? (
        <SurfaceCard>
          <h2 className="text-lg font-semibold">Organisation activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit entries recorded against this organisation only.
          </p>
          <div className="mt-4 text-sm">
            {auditLogs.data && auditLogs.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {auditLogs.data.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-medium">{entry.action}</span>
                    <time dateTime={entry.created_at} className="text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No activity recorded yet.</p>
            )}
          </div>
        </SurfaceCard>
      ) : null}

      {canManage ? <EnterprisePanel organization={organization} canManage /> : null}

      <OrgDataRightsPanel
        organizationId={organization.id}
        organizationName={organization.name}
        canManage={canManage}
      />

      <EntityFormModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a member"
        description={`The person is added to ${organization.name} with an invitation they must accept.`}
        fields={inviteFields}
        schema={inviteMemberSchema}
        initialValues={{ email: "", role: "member" }}
        submitLabel="Send invitation"
        onSubmit={async (values) => {
          await invite.mutateAsync(values as InviteMemberInput);
        }}
      />

      <EntityFormModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Organisation settings"
        fields={settingsFields}
        schema={organizationSettingsSchema}
        initialValues={{
          timezone: current?.timezone ?? "Asia/Kolkata",
          seat_limit: current?.seat_limit ? String(current.seat_limit) : "",
          allow_domain_join: current?.allow_domain_join ? "yes" : "no",
          allowed_email_domains: (current?.allowed_email_domains ?? []).join(", "),
        }}
        submitLabel="Save settings"
        onSubmit={async (values) => {
          await saveSettings.mutateAsync(values as OrganizationSettingsInput);
        }}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove this member?"
        description="They lose organisation-granted access and their organisation roles. Their own attempts, results and individual purchases are kept."
        confirmLabel="Remove member"
        tone="destructive"
        onConfirm={() => {
          if (pendingRemove) remove.mutate(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </div>
  );
}