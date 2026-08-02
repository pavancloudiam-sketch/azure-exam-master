import writeXlsxFile, { type Sheet, type SheetData } from "write-excel-file/browser";

import { COLUMN_GUIDE, IMPORT_COLUMNS, type ImportColumn } from "../types";

/**
 * Demonstration rows written for AskMeExam. All content here is original and
 * illustrative — the import format is for content you own or are licensed to
 * use, never for copied or leaked examination material.
 */
export const EXAMPLE_ROWS: Record<ImportColumn, string>[] = [
  {
    external_id: "DEMO-001",
    certification: "ENTRA-ID",
    domain: "Identity governance",
    topic: "Access reviews",
    question_type: "single_choice",
    scenario_text: "",
    question_text:
      "A team lead must confirm every quarter that their reports still need access to a group. Which capability is designed for this?",
    option_a: "An access review with the group owner as reviewer",
    option_b: "A conditional access policy in report-only mode",
    option_c: "A named location restriction",
    option_d: "A password protection policy",
    option_e: "",
    correct_options: "A",
    explanation:
      "Access reviews ask a nominated reviewer to confirm or remove membership on a recurring schedule. The other options control sign-in conditions rather than membership.",
    difficulty: "easy",
    point_value: "1",
    tags: "governance|access-reviews",
    status: "active",
  },
  {
    external_id: "DEMO-002",
    certification: "ENTRA-ID",
    domain: "Authentication",
    topic: "Multifactor authentication",
    question_type: "multiple_choice",
    scenario_text: "",
    question_text:
      "Which two factors satisfy a phishing-resistant multifactor requirement for a workforce sign-in?",
    option_a: "A FIDO2 security key",
    option_b: "An SMS one-time passcode",
    option_c: "A certificate-based smart card",
    option_d: "A security question",
    option_e: "An email one-time passcode",
    correct_options: "A|C",
    explanation:
      "Hardware-bound credentials such as FIDO2 keys and smart-card certificates resist phishing because the secret never leaves the device. Codes delivered over SMS or email, and knowledge answers, can be relayed to an attacker.",
    difficulty: "medium",
    point_value: "2",
    tags: "authentication|mfa|phishing-resistant",
    status: "active",
  },
  {
    external_id: "DEMO-003",
    certification: "ENTRA-ID",
    domain: "Access management",
    topic: "Conditional access",
    question_type: "scenario_single_choice",
    scenario_text:
      "Northwind Freight has 400 staff. Contractors sign in from unmanaged laptops and currently reach the finance app with a password only. Security wants contractor access blocked from unmanaged devices without affecting employees.",
    question_text: "Which change meets the requirement with the least administrative effort?",
    option_a: "Require a compliant or hybrid-joined device for the contractor group on the finance app",
    option_b: "Disable the finance app for all users outside office hours",
    option_c: "Reset every contractor password and enforce a 90-day expiry",
    option_d: "Move contractors into the same group as employees",
    option_e: "",
    correct_options: "A",
    explanation:
      "A device-state condition scoped to the contractor group and the single application meets the requirement precisely. The other options either affect employees or do not address device state at all.",
    difficulty: "hard",
    point_value: "3",
    tags: "conditional-access|device-state",
    status: "draft",
  },
];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildTemplateCsv(): string {
  const lines = [IMPORT_COLUMNS.join(",")];
  for (const row of EXAMPLE_ROWS) {
    lines.push(IMPORT_COLUMNS.map((column) => csvCell(row[column])).join(","));
  }
  // Excel opens UTF-8 CSV correctly only with a byte-order mark.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate() {
  download(new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" }), "askmeexam-question-import-template.csv");
}

type Cell = { value: string; fontWeight?: "bold"; wrap?: boolean; backgroundColor?: string };

/**
 * Two-sheet workbook: `questions` holds the header row plus demonstration
 * rows, `instructions` documents every column so the file is self-describing.
 */
export async function downloadXlsxTemplate() {
  const header: Cell[] = IMPORT_COLUMNS.map((column) => ({
    value: column,
    fontWeight: "bold" as const,
    backgroundColor: "#E8EEF7",
  }));
  const body = EXAMPLE_ROWS.map((row) =>
    IMPORT_COLUMNS.map((column) => ({ value: row[column], wrap: true })),
  );

  const guideHeader: Cell[] = ["column", "required", "accepted values", "notes"].map((value) => ({
    value,
    fontWeight: "bold" as const,
    backgroundColor: "#E8EEF7",
  }));
  const guideBody = IMPORT_COLUMNS.map((column) => [
    { value: column },
    { value: COLUMN_GUIDE[column].required ? "yes" : "no" },
    { value: COLUMN_GUIDE[column].accepts, wrap: true },
    { value: COLUMN_GUIDE[column].notes, wrap: true },
  ]);

  const sheets: Sheet<Blob>[] = [
    {
      sheet: "questions",
      data: [header, ...body] as SheetData,
      columns: IMPORT_COLUMNS.map(() => ({ width: 28 })),
    },
    {
      sheet: "instructions",
      data: [guideHeader, ...guideBody] as SheetData,
      columns: [{ width: 20 }, { width: 12 }, { width: 40 }, { width: 80 }],
    },
  ];

  await writeXlsxFile(sheets).toFile("askmeexam-question-import-template.xlsx");
}