import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { recordAudit } from "@/features/admin/services/audit-service";
import {
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  ATTESTATION_STATEMENT,
  type ImportBatch,
  type ImportColumn,
  type ImportStagedRow,
  type ParsedFile,
  type ParsedRow,
  type ReviewStatus,
} from "../types";
import { normalizeRow } from "../validation/import-schemas";
import { logError } from "@/features/observability";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 1000;

function headerKey(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s-]+/g, "_");
}

function toRecords(matrix: string[][]): {
  records: Record<string, string>[];
  missingColumns: ImportColumn[];
  unknownColumns: string[];
} {
  const [headerRow = [], ...bodyRows] = matrix;
  const headers = headerRow.map(headerKey);
  const known = new Set<string>(IMPORT_COLUMNS);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  const unknownColumns = headers.filter((header) => header && !known.has(header));

  const records = bodyRows
    .filter((row) => row.some((cell) => (cell ?? "").trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = (row[index] ?? "").toString().trim();
      });
      return record;
    });

  return { records, missingColumns, unknownColumns };
}

async function readMatrix(file: File): Promise<{ matrix: string[][]; fileType: "csv" | "xlsx" }> {
  const isXlsx = /\.xlsx$/i.test(file.name);
  if (isXlsx) {
    const rows = await readSheet(file);
    return {
      fileType: "xlsx",
      matrix: rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell)))),
    };
  }
  const text = await file.text();
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  return { fileType: "csv", matrix: result.data.map((row) => row.map((cell) => cell ?? "")) };
}

/** Parses and validates entirely in the browser. Nothing is written yet. */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File is larger than the 5 MB limit.");
  if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("Only .csv and .xlsx files are supported.");

  const { matrix, fileType } = await readMatrix(file);
  const { records, missingColumns, unknownColumns } = toRecords(matrix);
  if (records.length === 0) throw new Error("The file contains no data rows.");
  if (records.length > MAX_ROWS) throw new Error(`Files are limited to ${MAX_ROWS} rows per upload.`);

  const seen = new Map<string, number>();
  const rows: ParsedRow[] = records.map((raw, index) => {
    const rowNumber = index + 2; // header occupies row 1
    const { normalized, issues } = normalizeRow(raw);
    const externalId = (raw["external_id"] ?? "").trim();

    if (externalId) {
      const previous = seen.get(externalId);
      if (previous) {
        issues.push({
          column: "external_id",
          message: `Duplicate external_id — also used on row ${previous}.`,
        });
      } else {
        seen.set(externalId, rowNumber);
      }
    }

    for (const column of missingColumns) {
      issues.push({ column, message: `Required column "${column}" is missing from the file.` });
    }

    return { rowNumber, raw, issues, normalized: issues.length > 0 ? null : normalized };
  });

  return { filename: file.name, fileType, rows, missingColumns, unknownColumns };
}

/**
 * Persists the parsed file as a temporary staged batch. Staged rows never
 * reach the question bank — committing is a separate, later step.
 */
export async function stageImport(parsed: ParsedFile, certificationId: string | null): Promise<ImportBatch> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("You must be signed in to stage an import.");

  const validRows = parsed.rows.filter((row) => row.normalized !== null).length;

  const { data: batch, error } = await supabase
    .from("import_batches")
    .insert({
      created_by: userId,
      certification_id: certificationId,
      filename: parsed.filename,
      file_type: parsed.fileType,
      total_rows: parsed.rows.length,
      valid_rows: validRows,
      error_rows: parsed.rows.length - validRows,
      notes: parsed.unknownColumns.length
        ? `Ignored unrecognised columns: ${parsed.unknownColumns.join(", ")}`
        : null,
    })
    .select()
    .single();
  if (error) {
    logError("import.stage_failed", "Could not create import batch", error, {
      total_rows: parsed.rows.length,
      file_type: parsed.fileType,
    });
    throw error;
  }

  const payload = parsed.rows.map((row) => ({
    batch_id: batch.id,
    row_number: row.rowNumber,
    external_id: row.raw["external_id"] ?? null,
    raw: row.raw as unknown as Json,
    normalized: (row.normalized ?? {}) as unknown as Json,
    errors: row.issues as unknown as Json,
    is_valid: row.normalized !== null,
  }));

  for (let index = 0; index < payload.length; index += 200) {
    const { error: rowsError } = await supabase
      .from("import_staged_rows")
      .insert(payload.slice(index, index + 200));
    if (rowsError) {
      await supabase.from("import_batches").delete().eq("id", batch.id);
      logError("import.stage_failed", "Could not persist staged rows", rowsError, {
        batch_id: batch.id,
        chunk_start: index,
      });
      throw rowsError;
    }
  }

  await recordAudit({
    action: "import.staged",
    entityType: "import_batch",
    entityId: batch.id,
    entityLabel: parsed.filename,
    details: { total: parsed.rows.length, valid: validRows, invalid: parsed.rows.length - validRows },
  });

  return batch;
}

/**
 * Records the admin's manual originality attestation against the batch.
 * The attesting admin, timestamp and import (batch) id are stored server-side.
 */
export async function attestBatch(batchId: string): Promise<ImportBatch> {
  const { data, error } = await supabase.rpc("attest_import_batch", {
    _batch_id: batchId,
    _statement: ATTESTATION_STATEMENT,
  });
  if (error) {
    logError("import.attestation_failed", "Attestation could not be recorded", error, {
      batch_id: batchId,
    });
    throw error;
  }
  const batch = (Array.isArray(data) ? data[0] : data) as ImportBatch;
  await recordAudit({
    action: "import.attested",
    entityType: "import_batch",
    entityId: batchId,
    entityLabel: batch?.filename ?? "import batch",
    details: { statement: ATTESTATION_STATEMENT },
  });
  return batch;
}

/**
 * Runs similarity detection against the internal question bank. Matches are
 * only flagged for administrator review — nothing is rejected or deleted.
 */
export async function scanBatchDuplicates(batchId: string): Promise<number> {
  const { data, error } = await supabase.rpc("scan_import_duplicates", { _batch_id: batchId });
  if (error) {
    logError("import.duplicate_scan_failed", "Duplicate scan failed", error, {
      batch_id: batchId,
    });
    throw error;
  }
  const flagged = Number(data ?? 0);
  await recordAudit({
    action: "import.duplicate_scan",
    entityType: "import_batch",
    entityId: batchId,
    entityLabel: "duplicate scan",
    details: { flagged_rows: flagged, scope: "internal_question_bank_only" },
  });
  return flagged;
}

/** Administrator decision on a flagged row. Purely editorial metadata. */
export async function setRowReview(
  row: ImportStagedRow,
  reviewStatus: Extract<ReviewStatus, "flagged" | "cleared">,
  note?: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("import_staged_rows")
    .update({
      review_status: reviewStatus,
      reviewed_by: userData.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", row.id);
  if (error) throw error;
}

export async function listBatches(): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function listStagedRows(batchId: string): Promise<ImportStagedRow[]> {
  const { data, error } = await supabase
    .from("import_staged_rows")
    .select("*")
    .eq("batch_id", batchId)
    .order("row_number");
  if (error) throw error;
  return data;
}

export async function discardBatch(batch: ImportBatch): Promise<void> {
  const { error } = await supabase
    .from("import_batches")
    .update({ status: "discarded" })
    .eq("id", batch.id)
    .eq("status", "staged");
  if (error) throw error;
  await recordAudit({
    action: "import.discarded",
    entityType: "import_batch",
    entityId: batch.id,
    entityLabel: batch.filename,
  });
}