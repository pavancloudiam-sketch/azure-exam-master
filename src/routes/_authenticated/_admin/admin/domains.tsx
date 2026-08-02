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
  SelectField,
  StatusAlert,
  StatusBadge,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import { EntityFormModal, type FieldDef } from "@/features/admin/components/EntityFormModal";
import { TaxonomyToolbar } from "@/features/admin/components/TaxonomyToolbar";
import {
  createDomain,
  listCertifications,
  listDomains,
  setDomainActive,
  updateDomain,
} from "@/features/admin/services/taxonomy-service";
import { domainSchema, type DomainInput } from "@/features/admin/validation/taxonomy-schemas";
import type { ActiveFilter, Domain } from "@/features/admin/types/taxonomy";

function DomainsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ActiveFilter>("all");
  const [certFilter, setCertFilter] = React.useState("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Domain | null>(null);
  const [pendingToggle, setPendingToggle] = React.useState<Domain | null>(null);

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const query = useQuery({ queryKey: ["domains"], queryFn: listDomains });

  const certOptions = (certifications.data ?? []).map((cert) => ({
    value: cert.id,
    label: `${cert.name} v${cert.version}${cert.lifecycle_status === 'retired' ? ' (retired)' : cert.is_active ? '' : ' (draft)'}`,
  }));

  const certName = (id: string) =>
    certifications.data?.find((cert) => cert.id === id)
      ? `${certifications.data.find((cert) => cert.id === id)!.name} v${certifications.data.find((cert) => cert.id === id)!.version}`
      : "—";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["domains"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const save = useMutation({
    mutationFn: async (input: DomainInput) =>
      editing ? updateDomain(editing.id, input) : createDomain(input),
    onSuccess: () => {
      notify.success(editing ? "Domain updated" : "Domain created");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: Domain) => setDomainActive(row, !row.is_active),
    onSuccess: (_data, row) => {
      notify.success(row.is_active ? "Domain deactivated" : "Domain activated");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const rows = (query.data ?? []).filter((row) => {
    const matchesSearch = !search || row.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      status === "all" || (status === "active" ? row.is_active : !row.is_active);
    const matchesCert = certFilter === "all" || row.certification_id === certFilter;
    return matchesSearch && matchesStatus && matchesCert;
  });

  const fields: FieldDef[] = [
    {
      name: "certification_id",
      label: "Certification",
      type: "select",
      required: true,
      options: certOptions,
    },
    { name: "name", label: "Domain name", type: "text", required: true },
    {
      name: "weight_percent",
      label: "Weight (%)",
      type: "number",
      hint: "Optional exam weighting between 0 and 100.",
    },
    { name: "sort_order", label: "Sort order", type: "number", required: true },
  ];

  const columns: Column<Domain>[] = [
    { key: "name", header: "Domain", render: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: "certification",
      header: "Certification",
      render: (row) => <span className="text-muted-foreground">{certName(row.certification_id)}</span>,
    },
    {
      key: "weight",
      header: "Weight",
      render: (row) => (row.weight_percent === null ? "—" : `${row.weight_percent}%`),
    },
    { key: "sort", header: "Order", render: (row) => row.sort_order },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            size="sm"
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
          >
            Edit
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingToggle(row)}>
            {row.is_active ? "Deactivate" : "Activate"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  const initialValues = {
    certification_id: editing?.certification_id ?? certifications.data?.[0]?.id ?? "",
    name: editing?.name ?? "",
    weight_percent: editing?.weight_percent === null || editing?.weight_percent === undefined ? "" : String(editing.weight_percent),
    sort_order: String(editing?.sort_order ?? 0),
  };

  return (
    <PageShell title="Domains" description="Domains belong to a certification.">
      <div className="space-y-6">
        <StatusAlert tone="info" title="Deactivation is reversible">
          Domains are never deleted. Deactivating hides a domain from students while questions,
          attempts and results that reference it remain unchanged.
        </StatusAlert>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TaxonomyToolbar
            searchId="domain-search"
            searchLabel="Search domains"
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
          >
            <div className="sm:w-64">
              <SelectField
                id="domain-cert-filter"
                label="Certification"
                value={certFilter}
                onValueChange={setCertFilter}
                options={[{ value: "all", label: "All certifications" }, ...certOptions]}
              />
            </div>
          </TaxonomyToolbar>
          <PrimaryButton
            disabled={certOptions.length === 0}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add domain
          </PrimaryButton>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Loading domains" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load domains"
            description={(query.error as Error).message}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            caption="Domains"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            emptyMessage="No domains match the current filters."
          />
        )}
      </div>

      <EntityFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit domain" : "Add domain"}
        fields={fields}
        schema={domainSchema}
        initialValues={initialValues}
        submitLabel={editing ? "Save changes" : "Create domain"}
        onSubmit={async (values) => {
          await save.mutateAsync(values as DomainInput);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => !open && setPendingToggle(null)}
        title={pendingToggle?.is_active ? "Deactivate domain?" : "Activate domain?"}
        description={
          pendingToggle?.is_active
            ? "The domain and its topics will be hidden from students. Historical attempts and results are preserved."
            : "The domain becomes visible to students when its certification is active."
        }
        confirmLabel={pendingToggle?.is_active ? "Deactivate" : "Activate"}
        {...(pendingToggle?.is_active ? { tone: "destructive" as const } : {})}
        onConfirm={() => {
          if (pendingToggle) toggle.mutate(pendingToggle);
          setPendingToggle(null);
        }}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/domains")({
  head: () => ({
    meta: [
      { title: "Domains — AskMeExam Admin" },
      { name: "description", content: "Manage AskMeExam certification domains." },
      { property: "og:title", content: "Domains — AskMeExam Admin" },
      { property: "og:description", content: "Manage AskMeExam certification domains." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DomainsPage,
});