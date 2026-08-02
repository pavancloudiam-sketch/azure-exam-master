import type { Tables } from "@/integrations/supabase/types";
import type { Difficulty, QuestionType } from "@/features/admin/types/questions";

export type ImportBatch = Tables<"import_batches">;
export type ImportStagedRow = Tables<"import_staged_rows">;

/** Option columns supported by the template. Trailing blanks are allowed. */
export const OPTION_LETTERS = ["a", "b", "c", "d", "e"] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

/** Column order is fixed — the parser matches on header name, not position. */
export const IMPORT_COLUMNS = [
  "external_id",
  "certification",
  "domain",
  "topic",
  "question_type",
  "scenario_text",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "option_e",
  "correct_options",
  "explanation",
  "difficulty",
  "point_value",
  "tags",
  "status",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const REQUIRED_COLUMNS: ImportColumn[] = [
  "external_id",
  "certification",
  "domain",
  "topic",
  "question_type",
  "question_text",
  "option_a",
  "option_b",
  "correct_options",
  "difficulty",
  "status",
];

export const QUESTION_TYPE_VALUES: QuestionType[] = [
  "single_choice",
  "multiple_choice",
  "scenario_single_choice",
  "scenario_multiple_choice",
];

export const DIFFICULTY_VALUES: Difficulty[] = ["easy", "medium", "hard"];

/** Row lifecycle in the question bank once the row is eventually committed. */
export const IMPORT_STATUS_VALUES = ["active", "draft", "inactive"] as const;
export type ImportRowStatus = (typeof IMPORT_STATUS_VALUES)[number];

export const COLUMN_GUIDE: Record<
  ImportColumn,
  { required: boolean; accepts: string; notes: string }
> = {
  external_id: {
    required: true,
    accepts: "Text, up to 64 characters",
    notes:
      "Your own stable reference for the question. Must be unique within the file; used later to match re-imports instead of creating duplicates.",
  },
  certification: {
    required: true,
    accepts: "Certification code or name",
    notes: "Must already exist and be active, e.g. ENTRA-ID.",
  },
  domain: {
    required: true,
    accepts: "Domain name",
    notes: "Must already exist under the given certification.",
  },
  topic: {
    required: true,
    accepts: "Topic name",
    notes: "Must already exist under the given domain.",
  },
  question_type: {
    required: true,
    accepts: QUESTION_TYPE_VALUES.join(" | "),
    notes:
      "single_choice and scenario_single_choice take exactly one correct option; the multiple_choice variants take two or more.",
  },
  scenario_text: {
    required: false,
    accepts: "Text",
    notes:
      "Required for the scenario_* types, and must be empty for the non-scenario types. The shared background shown above the question.",
  },
  question_text: {
    required: true,
    accepts: "Text",
    notes: "The question stem itself.",
  },
  option_a: { required: true, accepts: "Text", notes: "First answer option." },
  option_b: { required: true, accepts: "Text", notes: "Second answer option." },
  option_c: {
    required: false,
    accepts: "Text",
    notes: "Optional. Leave empty to use fewer options.",
  },
  option_d: {
    required: false,
    accepts: "Text",
    notes: "Optional. May only be used when option_c is filled.",
  },
  option_e: {
    required: false,
    accepts: "Text",
    notes: "Optional. May only be used when option_d is filled.",
  },
  correct_options: {
    required: true,
    accepts: "Option letters, e.g. A or A|C or A,C",
    notes:
      "Case-insensitive. Separate multiple correct options with a pipe, comma or semicolon. Every letter must point at a filled option column.",
  },
  explanation: {
    required: false,
    accepts: "Text",
    notes: "Shown to a student only after they submit their attempt.",
  },
  difficulty: {
    required: true,
    accepts: DIFFICULTY_VALUES.join(" | "),
    notes: "Case-insensitive.",
  },
  point_value: {
    required: false,
    accepts: "Whole number, 1–10",
    notes: "Defaults to 1 when empty.",
  },
  tags: {
    required: false,
    accepts: "Free-text labels separated by a pipe, comma or semicolon",
    notes: "Optional grouping labels, e.g. conditional-access|mfa.",
  },
  status: {
    required: true,
    accepts: IMPORT_STATUS_VALUES.join(" | "),
    notes:
      "active = live for students, draft = imported but withheld, inactive = retired and never delivered.",
  },
};

export type RowIssue = { column: ImportColumn | "row"; message: string };

export type NormalizedRow = {
  external_id: string;
  certification: string;
  domain: string;
  topic: string;
  question_type: QuestionType;
  scenario_text: string | null;
  question_text: string;
  options: { letter: OptionLetter; content: string; is_correct: boolean }[];
  correct_options: OptionLetter[];
  explanation: string | null;
  difficulty: Difficulty;
  point_value: number;
  tags: string[];
  status: ImportRowStatus;
};

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: NormalizedRow | null;
  issues: RowIssue[];
};

export type ParsedFile = {
  filename: string;
  fileType: "csv" | "xlsx";
  rows: ParsedRow[];
  missingColumns: ImportColumn[];
  unknownColumns: string[];
};

/**
 * Duplicate detection compares staged rows against the internal AskMeExam
 * question bank only. No external plagiarism service is configured, and a
 * similarity score is an editorial signal — never proof of originality.
 */
export const ATTESTATION_STATEMENT =
  "I confirm that this content is original or that I have the necessary rights to use it.";

export type DuplicateStatus =
  | "unchecked"
  | "none"
  | "exact"
  | "normalized"
  | "near"
  | "similar_options";

export type ReviewStatus = "pending" | "flagged" | "cleared";

export type DuplicateMatch = {
  question_id: string;
  stem: string;
  match_type: Exclude<DuplicateStatus, "unchecked" | "none">;
  score: number;
};

export const DUPLICATE_LABELS: Record<DuplicateStatus, string> = {
  unchecked: "Not scanned",
  none: "No match",
  exact: "Exact duplicate text",
  normalized: "Normalized duplicate text",
  near: "Near-identical wording",
  similar_options: "Similar scenario / options",
};