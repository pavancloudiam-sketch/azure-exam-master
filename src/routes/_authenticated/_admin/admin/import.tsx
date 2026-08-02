import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ConfirmDialog,
  DataTable,
  CheckboxField,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import { listCertifications } from "@/features/admin/services/taxonomy-service";
import { StagedRowsTable } from "@/features/import/components/StagedRowsTable";
import { TemplateGuide } from "@/features/import/components/TemplateGuide";
import { DuplicateReviewPanel } from "@/features/import/components/DuplicateReviewPanel";
import {
  MAX_FILE_BYTES,
  MAX_ROWS,
  attestBatch,
  discardBatch,
  listBatches,
  parseImportFile,
  scanBatchDuplicates,
  stageImport,
} from "@/features/import/services/import-service";
import {
  downloadCsvTemplate,
  downloadXlsxTemplate,
} from "@/features/import/services/template-service";
import { ATTESTATION_STATEMENT, type ImportBatch, type ParsedFile } from "@/features/import/types";

const batchTone = {
  staged: "info",
  committed: "success",
  discarded: "neutral",
  expired: "warning",
} as const;

function ImportPage() {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [certificationId, setCertificationId] = React.useState("");
  const [pendingDiscard, setPendingDiscard] = React.useState<ImportBatch | null>(null);
  const [attested, setAttested] = React.useState(false);
  const [attestError, setAttestError] = React.useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = React.useState<string | null>(null);

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const batches = useQuery({ queryKey: ["import-batches"], queryFn: listBatches });

  const parse = useMutation({
    mutationFn: parseImportFile,
    onMutate: () => {
      setParseError(null);
      setParsed(null);
    },
    onSuccess: (result) => {
      setParsed(result);
      notify.success(`Parsed ${result.rows.length} row${result.rows.length === 1 ? "" : "s"} — nothing imported yet`);
    },
    onError: (error: Error) => setParseError(error.message),
  });

  const stage = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("Upload and parse a file first.");
      if (!attested) throw new Error("Confirm the originality attestation before staging.");
      const batch = await stageImport(parsed, certificationId || null);
      await attestBatch(batch.id);
      await scanBatchDuplicates(batch.id);
      return batch;
    },
    onSuccess: (batch) => {
      notify.success("Import staged, attested and scanned for duplicates. No questions have been created.");
      setParsed(null);
      setAttested(false);
      setSelectedBatchId(batch.id);
      if (inputRef.current) inputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const discard = useMutation({
    mutationFn: discardBatch,
    onSuccess: () => {
      notify.success("Staged import discarded");
      setPendingDiscard(null);
      void queryClient.invalidateQueries({ queryKey: ["import-batches"] });
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const validCount = parsed?.rows.filter((row) => row.issues.length === 0).length ?? 0;
  const invalidCount = (parsed?.rows.length ?? 0) - validCount;
  const selectedBatch = (batches.data ?? []).find((batch) => batch.id === selectedBatchId) ?? null;

  const batchColumns: Column<ImportBatch>[] = [
    { key: "file", header: "File", render: (row) => <span className="text-sm font-medium">{row.filename}</span> },
    { key: "type", header: "Format", render: (row) => <span className="text-sm uppercase">{row.file_type}</span> },
    {
      key: "rows",
      header: "Rows",
      render: (row) => (
        <span className="text-sm">
          {row.valid_rows} valid / {row.error_rows} with errors
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge tone={batchTone[row.status as keyof typeof batchTone] ?? "neutral"}>{row.status}</StatusBadge>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{new Date(row.expires_at).toLocaleString()}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => setSelectedBatchId(row.id)}>
            Review
          </SecondaryButton>
          {row.status === "staged" ? (
            <SecondaryButton type="button" onClick={() => setPendingDiscard(row)}>
              Discard
            </SecondaryButton>
          ) : null}
        </div>
      ),
    },
  ];

  const flaggedColumn: Column<ImportBatch> = {
    key: "flagged",
    header: "Duplicate check",
    render: (row) =>
      row.duplicate_scanned_at ? (
        <StatusBadge tone={row.flagged_rows > 0 ? "warning" : "success"}>
          {row.flagged_rows} flagged
        </StatusBadge>
      ) : (
        <StatusBadge tone="neutral">not scanned</StatusBadge>
      ),
  };
  batchColumns.splice(3, 0, flaggedColumn);

  return (
    <PageShell
      title="Bulk question import"
      description="Upload a CSV or Excel file of original, properly licensed questions. Uploads are staged for review only — nothing enters the question bank until an import is committed."
    >
      <div className="space-y-8">
        <StatusAlert tone="warning" title="Content responsibility">
          Only import questions you have authored or are licensed to use. Do not upload copied, leaked or otherwise
          proprietary examination material.
        </StatusAlert>

        <SurfaceCard title="1. Download a template" description="Both templates share the same columns and include three original demonstration rows.">
          <div className="flex flex-wrap gap-3">
            <PrimaryButton type="button" onClick={() => downloadCsvTemplate()}>
              Download CSV template
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => void downloadXlsxTemplate()}>
              Download Excel template
            </SecondaryButton>
          </div>
          <div className="mt-6">
            <TemplateGuide />
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="2. Upload and validate"
          description={`Maximum ${MAX_ROWS} rows and ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB per file. Parsing happens before anything is saved.`}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="import-file" className="mb-1.5 block text-sm font-medium">
                Question file (.csv or .xlsx)
              </label>
              <input
                id="import-file"
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) parse.mutate(file);
                }}
              />
            </div>
            <SelectField
              id="import-certification"
              label="Target certification (optional)"
              value={certificationId}
              hint="Recorded on the staged batch to help reviewers."
              onValueChange={(value) => setCertificationId(value === "__file__" ? "" : value)}
              options={[
                { value: "__file__", label: "Use the certification column in the file" },
                ...(certifications.data ?? []).map((certification) => ({
                  value: certification.id,
                  label: `${certification.code} — ${certification.name}`,
                })),
              ]}
            />
          </div>

          {parse.isPending ? <LoadingBlock label="Parsing file…" /> : null}
          {parseError ? (
            <div className="mt-4">
              <StatusAlert tone="error" title="File could not be parsed">
                {parseError}
              </StatusAlert>
            </div>
          ) : null}

          {parsed ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone="info">{parsed.rows.length} rows</StatusBadge>
                <StatusBadge tone="success">{validCount} valid</StatusBadge>
                <StatusBadge tone={invalidCount > 0 ? "error" : "neutral"}>{invalidCount} with errors</StatusBadge>
              </div>
              {parsed.missingColumns.length > 0 ? (
                <StatusAlert tone="error" title="Missing required columns">
                  {parsed.missingColumns.join(", ")}
                </StatusAlert>
              ) : null}
              {parsed.unknownColumns.length > 0 ? (
                <StatusAlert tone="warning" title="Unrecognised columns will be ignored">
                  {parsed.unknownColumns.join(", ")}
                </StatusAlert>
              ) : null}
              <StagedRowsTable rows={parsed.rows} />
              <div className="rounded-md border border-border bg-surface p-4">
                <CheckboxField
                  id="import-attestation"
                  label={ATTESTATION_STATEMENT}
                  checked={attested}
                  error={attestError ?? undefined}
                  hint="Recorded against this import with your account and the current time. AskMeExam's automated similarity check compares against its own question bank only and does not establish legal originality."
                  onCheckedChange={(checked) => {
                    setAttested(checked);
                    if (checked) setAttestError(null);
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <PrimaryButton
                  type="button"
                  onClick={() => {
                    if (!attested) {
                      setAttestError("You must confirm the attestation before staging this import.");
                      return;
                    }
                    stage.mutate();
                  }}
                  disabled={stage.isPending}
                >
                  {stage.isPending ? "Staging…" : "Stage import for review"}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    setParsed(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Clear
                </SecondaryButton>
                <span className="text-sm text-muted-foreground">
                  Staging saves a temporary copy only. Committing to the question bank is a separate step.
                </span>
              </div>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard title="3. Staged imports" description="Temporary batches you uploaded. They expire automatically after 24 hours.">
          {batches.isLoading ? (
            <LoadingBlock label="Loading staged imports…" />
          ) : batches.isError ? (
            <ErrorState
              title="Could not load staged imports"
              description={(batches.error as Error).message}
              onRetry={() => void batches.refetch()}
            />
          ) : (
            <DataTable
              caption="Staged import batches"
              columns={batchColumns}
              rows={batches.data ?? []}
              getRowId={(row) => row.id}
              emptyMessage="No imports staged yet."
            />
          )}
        </SurfaceCard>

        {selectedBatch ? (
          <SurfaceCard
            title="4. Duplicate review and attestation"
            description={`Similarity results for "${selectedBatch.filename}". Flags are advisory and must be resolved by an administrator before this batch is published.`}
          >
            <div className="mb-4 flex justify-end">
              <SecondaryButton type="button" onClick={() => setSelectedBatchId(null)}>
                Close review
              </SecondaryButton>
            </div>
            <DuplicateReviewPanel batch={selectedBatch} />
          </SurfaceCard>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDiscard !== null}
        title="Discard staged import?"
        description={`"${pendingDiscard?.filename ?? ""}" will be marked as discarded. No questions were created from it.`}
        confirmLabel="Discard"
        onConfirm={() => pendingDiscard && discard.mutate(pendingDiscard)}
        onOpenChange={(open) => !open && setPendingDiscard(null)}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/import")({
  head: () => ({
    meta: [
      { title: "Bulk question import — AskMeExam admin" },
      {
        name: "description",
        content:
          "Upload CSV or Excel question files, validate them against the AskMeExam template and stage them for review before import.",
      },
      { property: "og:title", content: "Bulk question import — AskMeExam admin" },
      {
        property: "og:description",
        content: "Validate and stage original certification questions before they reach the AskMeExam question bank.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});