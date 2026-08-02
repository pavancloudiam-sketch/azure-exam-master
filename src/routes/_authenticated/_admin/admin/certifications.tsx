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
import { TaxonomyToolbar } from "@/features/admin/components/TaxonomyToolbar";
import {
  createCertification,
  createCertificationVersion,
  listCertifications,
  retireCertificationVersion,
  setCertificationActive,
  updateCertification,
} from "@/features/admin/services/taxonomy-service";
import {
  certificationSchema,
  newVersionSchema,
  retireVersionSchema,
  type CertificationInput,
  type NewVersionInput,
  type RetireVersionInput,
} from "@/features/admin/validation/taxonomy-schemas";
import type { ActiveFilter, Certification } from "@/features/admin/types/taxonomy";

const fields: FieldDef[] = [
  { name: "code", label: "Code", type: "text", required: true, hint: "Letters, numbers and hyphens, e.g. ENTRA-ID." },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "provider", label: "Provider", type: "text", required: true, hint: "For example Microsoft." },
  { name: "exam_code", label: "Exam code", type: "text", hint: "Vendor exam code, e.g. SC-300." },
  { name: "version", label: "Version", type: "text", required: true, hint: "Version label such as 2024.1." },
  { name: "effective_at", label: "Effective date", type: "date", hint: "When this version becomes current." },
  { name: "description", label: "Description", type: "textarea" },
];

const newVersionFields: FieldDef[] = [
  { name: "version", label: "New version", type: "text", required: true, hint: "Must be unique within this certification." },
  { name: "exam_code", label: "Exam code", type: "text", hint: "Leave blank to keep the current exam code." },
  { name: "effective_at", label: "Effective date", type: "date" },
  {
    name: "clone_taxonomy",
    label: "Clone domains and topics",
    type: "select",
    required: true,
    options: [
      { value: "yes", label: "Yes — copy the taxonomy from this version" },
      { value: "no", label: "No — start with an empty taxonomy" },
    ],
  },
];

const retireFields: FieldDef[] = [
  { name: "retired_at", label: "Retirement date", type: "date", hint: "Defaults to today when left blank." },
  {
    name: "allow_new_attempts",
    label: "Allow new attempts after retirement",
    type: "select",
    required: true,
    options: [
      { value: "no", label: "No — block new attempts (recommended)" },
      { value: "yes", label: "Yes — explicitly keep this version open" },
    ],
  },
];

function lifecycleTone(row: Certification) {
  if (row.lifecycle_status === "retired") return "warning" as const;
  if (row.lifecycle_status === "active") return "success" as const;
  return "neutral" as const;
}

function CertificationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ActiveFilter>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Certification | null>(null);
  const [pendingToggle, setPendingToggle] = React.useState<Certification | null>(null);
  const [versionSource, setVersionSource] = React.useState<Certification | null>(null);
  const [retiring, setRetiring] = React.useState<Certification | null>(null);

  const query = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["certifications"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const save = useMutation({
    mutationFn: async (input: CertificationInput) =>
      editing ? updateCertification(editing.id, input) : createCertification(input),
    onSuccess: () => {
      notify.success(editing ? "Certification updated" : "Certification created (inactive)");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: Certification) => setCertificationActive(row, !row.is_active),
    onSuccess: (_data, row) => {
      notify.success(row.is_active ? "Certification deactivated" : "Certification activated");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const addVersion = useMutation({
    mutationFn: async (input: NewVersionInput) =>
      createCertificationVersion(versionSource!.id, input),
    onSuccess: () => {
      notify.success("New version created as a draft");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["domains"] });
      void queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const retire = useMutation({
    mutationFn: async (input: RetireVersionInput) =>
      retireCertificationVersion(retiring!.id, input),
    onSuccess: () => {
      notify.success("Version retired");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const rows = (query.data ?? []).filter((row) => {
    const matchesSearch =
      !search ||
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.code.toLowerCase().includes(search.toLowerCase()) ||
      row.provider.toLowerCase().includes(search.toLowerCase()) ||
      (row.exam_code ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      status === "all" || (status === "active" ? row.is_active : !row.is_active);
    return matchesSearch && matchesStatus;
  });

  const columns: Column<Certification>[] = [
    { key: "code", header: "Code", render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: "name", header: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: "provider",
      header: "Provider / exam",
      render: (row) => (
        <span className="text-muted-foreground">
          {row.provider}
          {row.exam_code ? ` · ${row.exam_code}` : ""}
        </span>
      ),
    },
    {
      key: "version",
      header: "Version",
      render: (row) => (
        <div className="space-y-1">
          <span className="font-mono text-xs">v{row.version}</span>
          <div className="text-xs text-muted-foreground">
            {row.effective_at ? `From ${row.effective_at}` : "No effective date"}
            {row.retired_at ? ` · Retired ${row.retired_at}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={lifecycleTone(row)}>
            {row.lifecycle_status === "retired"
              ? "Retired"
              : row.is_active
                ? "Active"
                : "Draft"}
          </StatusBadge>
          {row.lifecycle_status === "retired" && row.allow_new_attempts ? (
            <StatusBadge tone="info">New attempts allowed</StatusBadge>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton
            size="sm"
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
          >
            Edit
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setVersionSource(row)}>
            New version
          </SecondaryButton>
          {row.lifecycle_status !== "retired" ? (
            <SecondaryButton size="sm" onClick={() => setRetiring(row)}>
              Retire
            </SecondaryButton>
          ) : null}
          <SecondaryButton size="sm" onClick={() => setPendingToggle(row)}>
            {row.is_active ? "Deactivate" : "Activate"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  const initialValues = {
    code: editing?.code ?? "",
    name: editing?.name ?? "",
    provider: editing?.provider ?? "Microsoft",
    exam_code: editing?.exam_code ?? "",
    version: editing?.version ?? "1.0",
    effective_at: editing?.effective_at ?? "",
    description: editing?.description ?? "",
  };

  return (
    <PageShell
      title="Certifications"
      description="Manage certifications and their versions. The exam engine, scoring and attempt state machine are shared across every version."
    >
      <div className="space-y-6">
        <StatusAlert tone="info" title="Versions are never deleted">
          Each version is its own record with its own domains and topics. Retiring a version keeps
          historical attempts and results tied to the version they were taken on, and blocks new
          attempts unless you explicitly allow them.
        </StatusAlert>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TaxonomyToolbar
            searchId="certification-search"
            searchLabel="Search certifications"
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
          />
          <PrimaryButton
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add certification
          </PrimaryButton>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Loading certifications" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load certifications"
            description={(query.error as Error).message}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            caption="Certifications"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            emptyMessage="No certifications match the current filters."
          />
        )}
      </div>

      <EntityFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit certification" : "Add certification"}
        description={
          editing
            ? "Update certification details. Status is changed from the table."
            : "New certifications start as an inactive draft version so content can be prepared first."
        }
        fields={fields}
        schema={certificationSchema}
        initialValues={initialValues}
        submitLabel={editing ? "Save changes" : "Create certification"}
        onSubmit={async (values) => {
          await save.mutateAsync(values as CertificationInput);
        }}
      />

      <EntityFormModal
        open={versionSource !== null}
        onOpenChange={(open) => !open && setVersionSource(null)}
        title="Add certification version"
        {...(versionSource
          ? {
              description: `Creates a new draft version of ${versionSource.name} (currently v${versionSource.version}). Existing attempts stay on the version they were taken on.`,
            }
          : {})}
        fields={newVersionFields}
        schema={newVersionSchema}
        initialValues={{
          version: "",
          exam_code: versionSource?.exam_code ?? "",
          effective_at: "",
          clone_taxonomy: "yes",
        }}
        submitLabel="Create version"
        onSubmit={async (values) => {
          await addVersion.mutateAsync(values as NewVersionInput);
        }}
      />

      <EntityFormModal
        open={retiring !== null}
        onOpenChange={(open) => !open && setRetiring(null)}
        title="Retire certification version"
        {...(retiring
          ? {
              description: `${retiring.name} v${retiring.version} will stop accepting new attempts unless you explicitly allow them. Nothing is deleted.`,
            }
          : {})}
        fields={retireFields}
        schema={retireVersionSchema}
        initialValues={{ retired_at: "", allow_new_attempts: "no" }}
        submitLabel="Retire version"
        onSubmit={async (values) => {
          await retire.mutateAsync(values as RetireVersionInput);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => !open && setPendingToggle(null)}
        title={pendingToggle?.is_active ? "Deactivate certification?" : "Activate certification?"}
        description={
          pendingToggle?.is_active
            ? "Students will no longer see this certification. Nothing is deleted and existing attempts and results are preserved."
            : "Students will be able to see this certification and its active domains and topics."
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

export const Route = createFileRoute("/_authenticated/_admin/admin/certifications")({
  head: () => ({
    meta: [
      { title: "Certifications — AskMeExam Admin" },
      { name: "description", content: "Manage AskMeExam certifications." },
      { property: "og:title", content: "Certifications — AskMeExam Admin" },
      { property: "og:description", content: "Manage AskMeExam certifications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CertificationsPage,
});