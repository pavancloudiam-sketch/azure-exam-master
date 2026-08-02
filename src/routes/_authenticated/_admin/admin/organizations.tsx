import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ConfirmDialog,
  DataTable,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  StatusBadge,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import { EntityFormModal, type FieldDef } from "@/features/admin/components/EntityFormModal";
import { OrganizationWorkspace } from "@/features/organizations/components/OrganizationWorkspace";
import {
  createOrganization,
  listOrganizations,
  setOrganizationStatus,
} from "@/features/organizations/services/organization-service";
import {
  organizationSchema,
  type OrganizationInput,
} from "@/features/organizations/validation";
import type { Organization } from "@/features/organizations/types";

const fields: FieldDef[] = [
  { name: "name", label: "Organisation name", type: "text", required: true },
  {
    name: "slug",
    label: "Slug",
    type: "text",
    required: true,
    hint: "Short identifier, letters, numbers and hyphens.",
  },
  { name: "contact_email", label: "Contact email", type: "text" },
];

function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Organization | null>(null);
  const [pendingStatus, setPendingStatus] = React.useState<Organization | null>(null);

  const query = useQuery({ queryKey: ["organizations"], queryFn: listOrganizations });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["organizations"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const create = useMutation({
    mutationFn: (input: OrganizationInput) => createOrganization(input),
    onSuccess: () => {
      notify.success("Organisation created");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggleStatus = useMutation({
    mutationFn: (row: Organization) =>
      setOrganizationStatus(row.id, row.status === "active" ? "suspended" : "active"),
    onSuccess: () => {
      notify.success("Organisation status updated");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const columns: Column<Organization>[] = [
    {
      key: "name",
      header: "Organisation",
      render: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          <div className="font-mono text-xs text-muted-foreground">{row.slug}</div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <span className="text-muted-foreground">{row.contact_email ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge tone={row.status === "active" ? "success" : "warning"}>
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton size="sm" onClick={() => setSelected(row)}>
            Manage
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingStatus(row)}>
            {row.status === "active" ? "Suspend" : "Reactivate"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Organisations"
      description="Create and administer enterprise tenants. Platform administrators are separate from organisation administrators."
    >
      <div className="space-y-6">
        <StatusAlert tone="info" title="Individual students are unaffected">
          Students who do not belong to an organisation keep working exactly as before.
          Organisation membership is only created by invitation or administrative assignment.
        </StatusAlert>

        <div className="flex justify-end">
          <PrimaryButton onClick={() => setFormOpen(true)}>Add organisation</PrimaryButton>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Loading organisations" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load organisations"
            description={(query.error as Error).message}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            caption="Organisations"
            columns={columns}
            rows={query.data ?? []}
            getRowId={(row) => row.id}
            emptyMessage="No organisations yet."
          />
        )}

        {selected ? (
          <section aria-label={`Manage ${selected.name}`} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Managing {selected.name}</h2>
              <SecondaryButton size="sm" onClick={() => setSelected(null)}>
                Close
              </SecondaryButton>
            </div>
            <OrganizationWorkspace organization={selected} canManage />
          </section>
        ) : null}
      </div>

      <EntityFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add organisation"
        description="You become the initial owner. Ownership can be transferred by granting the owner role to another member."
        fields={fields}
        schema={organizationSchema}
        initialValues={{ name: "", slug: "", contact_email: "" }}
        submitLabel="Create organisation"
        onSubmit={async (values) => {
          await create.mutateAsync(values as OrganizationInput);
        }}
      />

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={
          pendingStatus?.status === "active" ? "Suspend organisation?" : "Reactivate organisation?"
        }
        description={
          pendingStatus?.status === "active"
            ? "Organisation-granted access stops applying to its members. Nothing is deleted and individual purchases are unaffected."
            : "Organisation-granted access applies to active members again."
        }
        confirmLabel={pendingStatus?.status === "active" ? "Suspend" : "Reactivate"}
        {...(pendingStatus?.status === "active" ? { tone: "destructive" as const } : {})}
        onConfirm={() => {
          if (pendingStatus) toggleStatus.mutate(pendingStatus);
          setPendingStatus(null);
        }}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/organizations")({
  head: () => ({
    meta: [
      { title: "Organisations — AskMeExam Admin" },
      { name: "description", content: "Administer AskMeExam enterprise organisations and members." },
      { property: "og:title", content: "Organisations — AskMeExam Admin" },
      {
        property: "og:description",
        content: "Administer AskMeExam enterprise organisations and members.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrganizationsPage,
});