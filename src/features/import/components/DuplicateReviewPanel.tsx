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
  notify,
  type BadgeTone,
  type Column,
} from "@/features/shared/components/ui";
import {
  commitBatch,
  listStagedRows,
  scanBatchDuplicates,
  setRowReview,
} from "../services/import-service";
import {
  DUPLICATE_LABELS,
  type DuplicateMatch,
  type DuplicateStatus,
  type ImportBatch,
  type ImportStagedRow,
} from "../types";

const duplicateTone: Record<DuplicateStatus, BadgeTone> = {
  unchecked: "neutral",
  none: "success",
  exact: "error",
  normalized: "error",
  near: "warning",
  similar_options: "warning",
};

function matchesOf(row: ImportStagedRow): DuplicateMatch[] {
  return Array.isArray(row.duplicate_matches) ? (row.duplicate_matches as unknown as DuplicateMatch[]) : [];
}

export function DuplicateReviewPanel({ batch }: { batch: ImportBatch }) {
  const queryClient = useQueryClient();
  const rows = useQuery({
    queryKey: ["import-staged-rows", batch.id],
    queryFn: () => listStagedRows(batch.id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["import-staged-rows", batch.id] });
    void queryClient.invalidateQueries({ queryKey: ["import-batches"] });
  };

  const scan = useMutation({
    mutationFn: () => scanBatchDuplicates(batch.id),
    onSuccess: (flagged) => {
      notify.success(
        flagged === 0
          ? "No similar questions found in the AskMeExam question bank"
          : `${flagged} row${flagged === 1 ? "" : "s"} flagged for review — nothing was rejected`,
      );
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const review = useMutation({
    mutationFn: ({ row, status }: { row: ImportStagedRow; status: "flagged" | "cleared" }) =>
      setRowReview(row, status),
    onSuccess: () => invalidate(),
    onError: (error: Error) => notify.error(error.message),
  });

  const [confirmCommit, setConfirmCommit] = React.useState(false);

  const commit = useMutation({
    mutationFn: () => commitBatch(batch),
    onSuccess: (report) => {
      setConfirmCommit(false);
      notify.success(
        `Import committed — ${report.imported} question${report.imported === 1 ? "" : "s"} created` +
          (report.skipped_invalid > 0 ? `, ${report.skipped_invalid} invalid row(s) skipped` : ""),
      );
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
      void queryClient.invalidateQueries({ queryKey: ["question-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (error: Error) => {
      setConfirmCommit(false);
      notify.error(error.message);
    },
  });

  const data = rows.data ?? [];
  const flagged = data.filter((row) => row.duplicate_status !== "none" && row.duplicate_status !== "unchecked");
  const pending = flagged.filter((row) => row.review_status === "pending");
  const validRows = data.filter((row) => row.is_valid);
  const invalidRows = data.length - validRows.length;
  const unresolved = validRows.filter(
    (row) =>
      row.duplicate_status !== "none" &&
      row.duplicate_status !== "unchecked" &&
      row.review_status !== "cleared",
  ).length;
  const isCommitted = batch.status === "committed";
  const canCommit =
    !isCommitted &&
    batch.status === "staged" &&
    Boolean(batch.attested_at) &&
    validRows.length > 0 &&
    unresolved === 0 &&
    new Date(batch.expires_at).getTime() > Date.now();

  const columns: Column<ImportStagedRow>[] = [
    { key: "row", header: "Row", render: (row) => <span className="font-mono text-xs">{row.row_number}</span> },
    {
      key: "question",
      header: "Staged question",
      render: (row) => (
        <span className="line-clamp-2 max-w-xs text-sm">
          {(row.raw as Record<string, string> | null)?.["question_text"] ?? "—"}
        </span>
      ),
    },
    {
      key: "detection",
      header: "Detection",
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge tone={duplicateTone[row.duplicate_status as DuplicateStatus] ?? "neutral"}>
            {DUPLICATE_LABELS[row.duplicate_status as DuplicateStatus] ?? row.duplicate_status}
          </StatusBadge>
          {row.duplicate_score != null ? (
            <p className="text-xs text-muted-foreground">
              Highest similarity {Math.round(Number(row.duplicate_score) * 100)}%
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "matches",
      header: "Matches in the question bank",
      render: (row) => {
        const matches = matchesOf(row);
        if (matches.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <ul className="max-w-md space-y-1 text-xs">
            {matches.map((match) => (
              <li key={match.question_id}>
                <span className="font-medium">{DUPLICATE_LABELS[match.match_type]}</span>{" "}
                <span className="text-muted-foreground">({Math.round(match.score * 100)}%)</span>
                <span className="line-clamp-2 text-muted-foreground">{match.stem}</span>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      key: "review",
      header: "Review decision",
      render: (row) => {
        if (row.duplicate_status === "none") return <StatusBadge tone="success">No review needed</StatusBadge>;
        if (row.duplicate_status === "unchecked")
          return <span className="text-sm text-muted-foreground">Run the scan</span>;
        return (
          <div className="space-y-2">
            <StatusBadge
              tone={row.review_status === "cleared" ? "success" : row.review_status === "flagged" ? "error" : "warning"}
            >
              {row.review_status}
            </StatusBadge>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                type="button"
                onClick={() => review.mutate({ row, status: "cleared" })}
                disabled={review.isPending}
              >
                Keep — reviewed
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => review.mutate({ row, status: "flagged" })}
                disabled={review.isPending}
              >
                Hold for editing
              </SecondaryButton>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <StatusAlert tone="info" title="Internal comparison only">
        Similarity is checked against the AskMeExam question bank only — no external plagiarism-checking service is
        configured. A low similarity score is not evidence that content is original or legally cleared, and a match is
        never deleted or rejected automatically; it is flagged for your review.
      </StatusAlert>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" onClick={() => scan.mutate()} disabled={scan.isPending}>
          {scan.isPending ? "Scanning…" : batch.duplicate_scanned_at ? "Re-run duplicate scan" : "Run duplicate scan"}
        </PrimaryButton>
        {batch.duplicate_scanned_at ? (
          <span className="text-sm text-muted-foreground">
            Last scanned {new Date(batch.duplicate_scanned_at).toLocaleString()}
          </span>
        ) : null}
        <StatusBadge tone={flagged.length > 0 ? "warning" : "neutral"}>{flagged.length} flagged</StatusBadge>
        <StatusBadge tone={pending.length > 0 ? "warning" : "success"}>{pending.length} awaiting a decision</StatusBadge>
      </div>

      {batch.attested_at ? (
        <StatusAlert tone="success" title="Originality attestation recorded">
          “{batch.attestation_statement}” — recorded {new Date(batch.attested_at).toLocaleString()} against import{" "}
          <span className="font-mono text-xs">{batch.id}</span>.
        </StatusAlert>
      ) : (
        <StatusAlert tone="warning" title="No attestation recorded">
          This batch was staged before attestation was captured.
        </StatusAlert>
      )}

      {rows.isLoading ? (
        <LoadingBlock label="Loading staged rows…" />
      ) : rows.isError ? (
        <ErrorState
          title="Could not load staged rows"
          description={(rows.error as Error).message}
          onRetry={() => void rows.refetch()}
        />
      ) : (
        <DataTable
          caption="Duplicate detection results"
          columns={columns}
          rows={data}
          getRowId={(row) => row.id}
          emptyMessage="No staged rows in this batch."
        />
      )}

      <div className="rounded-md border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold">Commit to the question bank</h3>
        {isCommitted ? (
          <StatusAlert tone="success" title="Import committed">
            {batch.imported_rows} question{batch.imported_rows === 1 ? "" : "s"} created
            {batch.failed_rows > 0 ? `, ${batch.failed_rows} invalid row(s) skipped` : ""}
            {batch.committed_at ? ` on ${new Date(batch.committed_at).toLocaleString()}` : ""}.
          </StatusAlert>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Only the {validRows.length} valid row{validRows.length === 1 ? "" : "s"} will be imported
              {invalidRows > 0 ? `; ${invalidRows} row(s) with errors are skipped` : ""}. The import runs as a single
              transaction — if any row fails, nothing is created.
            </p>
            {!batch.attested_at ? (
              <p className="mt-2 text-sm text-destructive">
                The originality attestation must be recorded before this batch can be committed.
              </p>
            ) : null}
            {unresolved > 0 ? (
              <p className="mt-2 text-sm text-destructive">
                Resolve {unresolved} flagged duplicate row{unresolved === 1 ? "" : "s"} first.
              </p>
            ) : null}
            <div className="mt-4">
              <PrimaryButton
                type="button"
                onClick={() => setConfirmCommit(true)}
                disabled={!canCommit || commit.isPending}
              >
                {commit.isPending ? "Committing…" : "Commit import"}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmCommit}
        title="Commit this import?"
        description={`${validRows.length} question${validRows.length === 1 ? "" : "s"} will be created in the question bank from "${batch.filename}". This cannot be undone from here.`}
        confirmLabel="Commit import"
        onConfirm={() => commit.mutate()}
        onOpenChange={(open) => !open && setConfirmCommit(false)}
      />
    </div>
  );
}