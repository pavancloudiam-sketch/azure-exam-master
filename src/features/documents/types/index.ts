import type { Tables } from "@/integrations/supabase/types";

export type Document = Tables<"documents">;
export type DocumentFolder = Tables<"document_folders">;

export type DocumentCategory = Document["category"];
export type DocumentVisibility = Document["visibility"];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  study_notes: "Study notes",
  course_material: "Course material",
  revision_guide: "Revision guide",
  practice_material: "Practice material",
  reference: "Reference",
  policy: "Policy",
  trainer_internal: "Trainer internal",
};

export const DOCUMENT_VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  admin_only: "Admin only",
  trainer: "Trainers",
  students: "All students",
  exam_assigned: "Students with exam access",
};

export const DOCUMENT_CATEGORY_OPTIONS = Object.entries(DOCUMENT_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const DOCUMENT_VISIBILITY_OPTIONS = Object.entries(DOCUMENT_VISIBILITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** File extensions students and trainers are allowed to upload. */
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "txt",
  "md",
  "png",
  "jpg",
] as const;

export type AllowedDocumentExtension = (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number];

/** Maximum upload size in bytes (25 MB). */
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

export type DocumentFilters = {
  search?: string;
  folderId?: string | null;
  category?: DocumentCategory | "all";
  visibility?: DocumentVisibility | "all";
  certificationId?: string | "all";
  includeArchived?: boolean;
};
