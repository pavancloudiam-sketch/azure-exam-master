import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/features/admin/services/audit-service";

import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  type Document,
  type DocumentFilters,
  type DocumentFolder,
} from "../types";

const BUCKET = "documents";

/* --------------------------------- folders --------------------------------- */

export async function listFolders(includeArchived = false): Promise<DocumentFolder[]> {
  let query = supabase.from("document_folders").select("*").order("name", { ascending: true });
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createFolder(input: {
  name: string;
  description?: string | null;
  parentId?: string | null;
}): Promise<DocumentFolder> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("document_folders")
    .insert({
      name: input.name,
      description: input.description ? input.description : null,
      parent_id: input.parentId ? input.parentId : null,
      created_by: userData.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFolder(
  id: string,
  input: { name: string; description?: string | null; parentId?: string | null },
): Promise<DocumentFolder> {
  const { data, error } = await supabase
    .from("document_folders")
    .update({
      name: input.name,
      description: input.description ? input.description : null,
      parent_id: input.parentId ? input.parentId : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveFolder(id: string): Promise<void> {
  const { error } = await supabase.from("document_folders").update({ archived: true }).eq("id", id);
  if (error) throw error;
}

export async function restoreFolder(id: string): Promise<void> {
  const { error } = await supabase.from("document_folders").update({ archived: false }).eq("id", id);
  if (error) throw error;
}

/* -------------------------------- documents --------------------------------- */

export async function listDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });

  if (!filters.includeArchived) query = query.eq("archived", false);
  if (filters.folderId) query = query.eq("folder_id", filters.folderId);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.visibility && filters.visibility !== "all") query = query.eq("visibility", filters.visibility);
  if (filters.certificationId && filters.certificationId !== "all") {
    query = query.eq("certification_id", filters.certificationId);
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim().replace(/[%,]/g, " ")}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Documents a signed-in student may see. RLS enforces visibility rules. */
export async function listMyDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function extensionOf(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

export type DocumentUploadInput = {
  file: File;
  title: string;
  description?: string | null;
  folderId?: string | null;
  category: Document["category"];
  visibility: Document["visibility"];
  tags?: string[];
  certificationId?: string | null;
  domainId?: string | null;
  topicId?: string | null;
  examId?: string | null;
};

export async function uploadDocument(input: DocumentUploadInput): Promise<Document> {
  const extension = extensionOf(input.file.name);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])) {
    throw new Error(
      `Unsupported file type ".${extension || "unknown"}". Allowed types: ${ALLOWED_DOCUMENT_EXTENSIONS.join(", ")}.`,
    );
  }
  if (input.file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("File is too large. The maximum upload size is 25 MB.");
  }

  const { data: userData } = await supabase.auth.getUser();
  const storagePath = `${input.folderId ?? "root"}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type || undefined,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      folder_id: input.folderId ? input.folderId : null,
      title: input.title,
      description: input.description ? input.description : null,
      category: input.category,
      visibility: input.visibility,
      tags: input.tags ?? [],
      certification_id: input.certificationId ? input.certificationId : null,
      domain_id: input.domainId ? input.domainId : null,
      topic_id: input.topicId ? input.topicId : null,
      exam_id: input.examId ? input.examId : null,
      storage_path: storagePath,
      original_filename: input.file.name,
      mime_type: input.file.type || "application/octet-stream",
      file_extension: extension,
      size_bytes: input.file.size,
      uploaded_by: userData.user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }

  await recordAudit({
    action: "document.uploaded",
    entityType: "document",
    entityId: data.id,
    entityLabel: data.title,
    details: { category: data.category, visibility: data.visibility },
  });

  return data;
}

export async function updateDocument(
  id: string,
  input: {
    title: string;
    description?: string | null;
    folderId?: string | null;
    category: Document["category"];
    visibility: Document["visibility"];
    tags?: string[];
    certificationId?: string | null;
    domainId?: string | null;
    topicId?: string | null;
    examId?: string | null;
  },
): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .update({
      title: input.title,
      description: input.description ? input.description : null,
      folder_id: input.folderId ? input.folderId : null,
      category: input.category,
      visibility: input.visibility,
      tags: input.tags ?? [],
      certification_id: input.certificationId ? input.certificationId : null,
      domain_id: input.domainId ? input.domainId : null,
      topic_id: input.topicId ? input.topicId : null,
      exam_id: input.examId ? input.examId : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveDocument(document: Document): Promise<void> {
  const { error } = await supabase.from("documents").update({ archived: true }).eq("id", document.id);
  if (error) throw error;
  await recordAudit({
    action: "document.archived",
    entityType: "document",
    entityId: document.id,
    entityLabel: document.title,
  });
}

export async function restoreDocument(document: Document): Promise<void> {
  const { error } = await supabase.from("documents").update({ archived: false }).eq("id", document.id);
  if (error) throw error;
  await recordAudit({
    action: "document.restored",
    entityType: "document",
    entityId: document.id,
    entityLabel: document.title,
  });
}

export async function deleteDocument(document: Document): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([document.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("documents").delete().eq("id", document.id);
  if (error) throw error;
  await recordAudit({
    action: "document.deleted",
    entityType: "document",
    entityId: document.id,
    entityLabel: document.title,
  });
}

export async function createSignedUrl(document: Document, expiresIn = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Could not generate a download link for this file.");
  return data.signedUrl;
}
