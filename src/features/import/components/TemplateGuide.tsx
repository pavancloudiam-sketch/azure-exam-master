import { COLUMN_GUIDE, IMPORT_COLUMNS } from "../types";
import { DataTable, StatusBadge, type Column } from "@/features/shared/components/ui";

type GuideRow = { column: string; required: boolean; accepts: string; notes: string };

const rows: GuideRow[] = IMPORT_COLUMNS.map((column) => ({
  column,
  required: COLUMN_GUIDE[column].required,
  accepts: COLUMN_GUIDE[column].accepts,
  notes: COLUMN_GUIDE[column].notes,
}));

const columns: Column<GuideRow>[] = [
  {
    key: "column",
    header: "Column",
    render: (row) => <span className="font-mono text-xs">{row.column}</span>,
  },
  {
    key: "required",
    header: "Required",
    render: (row) => (
      <StatusBadge tone={row.required ? "info" : "neutral"}>{row.required ? "Required" : "Optional"}</StatusBadge>
    ),
  },
  { key: "accepts", header: "Accepted values", render: (row) => <span className="text-sm">{row.accepts}</span> },
  {
    key: "notes",
    header: "Notes",
    render: (row) => <span className="text-sm text-muted-foreground">{row.notes}</span>,
  },
];

export function TemplateGuide() {
  return <DataTable caption="Import template column reference" columns={columns} rows={rows} getRowId={(row) => row.column} />;
}