import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  TextField,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import {
  BlueprintFormModal,
  blueprintToValues,
  emptyBlueprintValues,
  type BlueprintFormValues,
} from "@/features/admin/components/BlueprintFormModal";
import {
  createBlueprint,
  getBlueprint,
  getBlueprintReadiness,
  listBlueprints,
  listScoringModels,
  replaceBlueprintDomains,
  setBlueprintPublished,
  updateBlueprint,
  type BlueprintReadiness,
} from "@/features/exams/services/blueprint-service";
import { listCertifications, listDomains } from "@/features/admin/services/taxonomy-service";
import type { ExamBlueprint } from "@/features/exams/types";

type BlueprintRow = ExamBlueprint & { certification: { code: string; name: string } | null };

function ReadinessPanel({ blueprint }: { blueprint: BlueprintRow }) {
  const readiness = useQuery({
    queryKey: ["blueprint-readiness", blueprint.id],
    queryFn: () => getBlueprintReadiness(blueprint.id),
  });

  if (readiness.isLoading) return <LoadingBlock label="Checking question-bank readiness" />;
  if (readiness.isError)
    return <ErrorState description="Readiness check failed." onRetry={() => readiness.refetch()} />;

  const data = readiness.data as BlueprintReadiness;
  return (
    <div className="space-y-4">
      <StatusAlert
        tone={data.satisfiable ? "success" : "warning"}
        title={
          data.satisfiable
            ? "Ready to publish"
            : "Not enough approved questions to satisfy this blueprint"
        }
      >
        {data.total_available} approved questions available. Maximum deliverable length{" "}
        {data.max_question_count}; the blueprint default is {data.default_question_count}.
      </StatusAlert>
      <ul className="space-y-2">
        {data.domains.map((domain) => (
          <li
            key={domain.domain_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
          >
            <span className="min-w-0 truncate font-medium">{domain.name}</span>
            <span className="text-muted-foreground">
              {domain.available} available / {domain.required} required
            </span>
            <StatusBadge tone={domain.satisfied ? "success" : "error"}>
              {domain.satisfied ? "Satisfied" : "Shortfall"}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlueprintsAdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [certFilter, setCertFilter] = React.useState("all");
  const [publishedFilter, setPublishedFilter] = React.useState<
    "all" | "published" | "unpublished"
  >("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BlueprintRow | null>(null);
  const [initialValues, setInitialValues] = React.useState<BlueprintFormValues | null>(null);
  const [pendingPublish, setPendingPublish] = React.useState<BlueprintRow | null>(null);
  const [readinessFor, setReadinessFor] = React.useState<BlueprintRow | null>(null);

  const blueprints = useQuery({ queryKey: ["admin-blueprints"], queryFn: listBlueprints });
  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const domains = useQuery({ queryKey: ["domains"], queryFn: listDomains });
  const scoringModels = useQuery({ queryKey: ["scoring-models"], queryFn: listScoringModels });

  const certificationOptions = (certifications.data ?? []).map((row) => ({
    value: row.id,
    label: `${row.code} ${row.version} — ${row.name}`,
  }));
  const scoringOptions = (scoringModels.data ?? []).map((row) => ({
    value: row.version,
    label: `${row.label} (${row.version})`,
  }));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-blueprints"] });
    void queryClient.invalidateQueries({ queryKey: ["blueprint-readiness"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const save = useMutation({
    mutationFn: async (values: BlueprintFormValues) => {
      const { domains: weights, ...fields } = values;
      const payload = { ...fields, description: fields.description || null };
      const row = editing
        ? await updateBlueprint(editing.id, payload)
        : await createBlueprint(payload);
      await replaceBlueprintDomains(
        row.id,
        weights.map((weight, index) => ({ ...weight, sort_order: index })),
      );
      return row;
    },
    onSuccess: () => {
      notify.success(editing ? "Blueprint updated" : "Blueprint created");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (row: BlueprintRow) => setBlueprintPublished(row.id, !row.is_published),
    onSuccess: (_data, row) => {
      notify.success(row.is_published ? "Blueprint unpublished" : "Blueprint published");
      invalidate();
    },
    onError: (error: Error) =>
      notify.error(
        error.message.includes("readiness") || error.message.includes("satisfi")
          ? "Publication blocked: the question bank cannot satisfy this blueprint yet."
          : error.message,
      ),
  });

  const openCreate = () => {
    setEditing(null);
    setInitialValues(emptyBlueprintValues(certificationOptions[0]?.value ?? ""));
    setFormOpen(true);
  };

  const openEdit = async (row: BlueprintRow, clone: boolean) => {
    const full = await getBlueprint(row.id);
    if (!full) {
      notify.error("Blueprint could not be loaded");
      return;
    }
    const values = blueprintToValues(full);
    setEditing(clone ? null : row);
    setInitialValues(clone ? { ...values, name: `${values.name} (copy)` } : values);
    setFormOpen(true);
  };

  const filtered = (blueprints.data ?? []).filter((row) => {
    const matchesSearch =
      !search ||
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      (row.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCert = certFilter === "all" || row.certification_id === certFilter;
    const matchesPublished =
      publishedFilter === "all" ||
      (publishedFilter === "published" ? row.is_published : !row.is_published);
    return matchesSearch && matchesCert && matchesPublished;
  });

  const columns: Column<BlueprintRow>[] = [
    {
      key: "name",
      header: "Blueprint",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.certification ? `${row.certification.code} — ${row.certification.name}` : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "config",
      header: "Configuration",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.default_question_count} questions ({row.min_question_count}–
          {row.max_question_count}) · pass {row.passing_scaled_score}/1000 ·{" "}
          {row.duration_minutes ? `${row.duration_minutes} min` : "untimed"} · model{" "}
          {row.scoring_model_version}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge tone={row.is_published ? "success" : "warning"}>
          {row.is_published ? "Published" : "Draft"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton size="sm" onClick={() => void openEdit(row, false)}>
            Edit
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => void openEdit(row, true)}>
            Clone
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setReadinessFor(row)}>
            Readiness
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingPublish(row)}>
            {row.is_published ? "Unpublish" : "Publish"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Exam blueprints"
      description="Define how many questions an attempt delivers, how skill areas are weighted and how attempts are scored."
      actions={
        <PrimaryButton onClick={openCreate} disabled={certificationOptions.length === 0}>
          New blueprint
        </PrimaryButton>
      }
    >
      <div className="space-y-6">
        <StatusAlert tone="info" title="Publication is guarded by readiness">
          A blueprint can only be published when the approved question bank can satisfy every
          skill-area range. Run the readiness check before publishing.
        </StatusAlert>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="blueprint-search"
            label="Search blueprints"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
          />
          <SelectField
            id="blueprint-cert-filter"
            label="Certification version"
            options={[{ value: "all", label: "All certifications" }, ...certificationOptions]}
            value={certFilter}
            onValueChange={setCertFilter}
          />
          <SelectField
            id="blueprint-published-filter"
            label="Publication"
            options={[
              { value: "all", label: "All" },
              { value: "published", label: "Published" },
              { value: "unpublished", label: "Draft" },
            ]}
            value={publishedFilter}
            onValueChange={(value) => setPublishedFilter(value as typeof publishedFilter)}
          />
        </div>

        {blueprints.isLoading ? (
          <LoadingBlock label="Loading blueprints" />
        ) : blueprints.isError ? (
          <ErrorState
            description="Blueprints could not be loaded."
            onRetry={() => blueprints.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No blueprints yet"
            description="Create a blueprint to control question counts, weighting and scoring for an exam."
          />
        ) : (
          <DataTable data={filtered} columns={columns} getRowId={(row) => row.id} />
        )}
      </div>

      {initialValues ? (
        <BlueprintFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          initialValues={initialValues}
          certifications={certificationOptions}
          scoringModels={scoringOptions}
          domains={domains.data ?? []}
          submitLabel={editing ? "Save blueprint" : "Create blueprint"}
          onSubmit={async (values) => {
            await save.mutateAsync(values);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingPublish)}
        onOpenChange={(open) => !open && setPendingPublish(null)}
        title={pendingPublish?.is_published ? "Unpublish blueprint?" : "Publish blueprint?"}
        description={
          pendingPublish?.is_published
            ? "Students will no longer receive attempts built from this blueprint. Existing attempts are unaffected."
            : "Publishing runs a readiness check in the database. If the question bank cannot satisfy the blueprint, publication is refused."
        }
        confirmLabel={pendingPublish?.is_published ? "Unpublish" : "Publish"}
        onConfirm={async () => {
          if (pendingPublish) await togglePublish.mutateAsync(pendingPublish);
          setPendingPublish(null);
        }}
      />

      {readinessFor ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setReadinessFor(null)}
          title={`Readiness — ${readinessFor.name}`}
          description="Approved question coverage for each weighted skill area."
          confirmLabel="Close"
          onConfirm={async () => setReadinessFor(null)}
        >
          <ReadinessPanel blueprint={readinessFor} />
        </ConfirmDialog>
      ) : null}
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/blueprints")({
  component: BlueprintsAdminPage,
});
