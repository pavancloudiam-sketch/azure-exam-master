import { DataTable, StatusBadge, type Column } from "@/features/shared/components/ui";
import type { ParsedRow } from "../types";

const columns: Column<ParsedRow>[] = [
  { key: "row", header: "Row", render: (row) => <span className="font-mono text-xs">{row.rowNumber}</span> },
  {
    key: "external_id",
    header: "external_id",
    render: (row) => <span className="font-mono text-xs">{row.raw["external_id"] || "—"}</span>,
  },
  {
    key: "question",
    header: "Question",
    render: (row) => (
      <span className="line-clamp-2 max-w-md text-sm">{row.raw["question_text"] || "—"}</span>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (row) => <span className="text-sm">{row.raw["question_type"] || "—"}</span>,
  },
  {
    key: "status",
    header: "Result",
    render: (row) =>
      row.issues.length === 0 ? (
        <StatusBadge tone="success">Valid</StatusBadge>
      ) : (
        <div className="space-y-1">
          <StatusBadge tone="error">{row.issues.length} issue{row.issues.length > 1 ? "s" : ""}</StatusBadge>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive-ink">
            {row.issues.map((issue, index) => (
              <li key={index}>
                <span className="font-mono">{issue.column}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ),
  },
];

export function StagedRowsTable({ rows }: { rows: ParsedRow[] }) {
  return (
    <DataTable
      caption="Parsed rows awaiting review"
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.rowNumber)}
      emptyMessage="No rows parsed."
    />
  );
}