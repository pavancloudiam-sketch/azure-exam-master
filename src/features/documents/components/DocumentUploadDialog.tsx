import * as React from "react";

import { Modal } from "@/features/shared/components/ui/Modal";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
  notify,
  type SelectOption,
} from "@/features/shared/components/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listCertifications, listDomains, listTopics } from "@/features/admin/services/taxonomy-service";
import { listAdminExams } from "@/features/admin/services/exam-admin-service";
import {
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_VISIBILITY_OPTIONS,
  type Document,
  type DocumentCategory,
  type DocumentFolder,
  type DocumentVisibility,
} from "../types";
import { updateDocument, uploadDocument } from "../services/document-service";

const NONE = "none";

export function DocumentUploadDialog({
  open,
  onOpenChange,
  folders,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: DocumentFolder[];
  editing?: Document | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(editing);

  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [folderId, setFolderId] = React.useState<string>(NONE);
  const [category, setCategory] = React.useState<DocumentCategory>("study_notes");
  const [visibility, setVisibility] = React.useState<DocumentVisibility>("students");
  const [tags, setTags] = React.useState("");
  const [certificationId, setCertificationId] = React.useState<string>(NONE);
  const [domainId, setDomainId] = React.useState<string>(NONE);
  const [topicId, setTopicId] = React.useState<string>(NONE);
  const [examId, setExamId] = React.useState<string>(NONE);
  const [error, setError] = React.useState<string | null>(null);

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const domains = useQuery({ queryKey: ["domains"], queryFn: listDomains });
  const topics = useQuery({ queryKey: ["topics"], queryFn: listTopics });
  const exams = useQuery({ queryKey: ["admin-exams"], queryFn: listAdminExams });

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setError(null);
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setFolderId(editing?.folder_id ?? NONE);
    setCategory(editing?.category ?? "study_notes");
    setVisibility(editing?.visibility ?? "students");
    setTags(editing?.tags?.join(", ") ?? "");
    setCertificationId(editing?.certification_id ?? NONE);
    setDomainId(editing?.domain_id ?? NONE);
    setTopicId(editing?.topic_id ?? NONE);
    setExamId(editing?.exam_id ?? NONE);
  }, [open, editing]);

  const folderOptions: SelectOption[] = [
    { value: NONE, label: "No folder (root)" },
    ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
  ];
  const certificationOptions: SelectOption[] = [
    { value: NONE, label: "None" },
    ...(certifications.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.version})` })),
  ];
  const domainOptions: SelectOption[] = [
    { value: NONE, label: "None" },
    ...(domains.data ?? [])
      .filter((d) => certificationId === NONE || d.certification_id === certificationId)
      .map((d) => ({ value: d.id, label: d.name })),
  ];
  const topicOptions: SelectOption[] = [
    { value: NONE, label: "None" },
    ...(topics.data ?? [])
      .filter((t) => domainId === NONE || t.domain_id === domainId)
      .map((t) => ({ value: t.id, label: t.name })),
  ];
  const examOptions: SelectOption[] = [
    { value: NONE, label: "None" },
    ...(exams.data ?? []).map((e) => ({ value: e.id, label: e.title })),
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const shared = {
        title: title.trim(),
        description: description.trim() || null,
        folderId: folderId === NONE ? null : folderId,
        category,
        visibility,
        tags: tagList,
        certificationId: certificationId === NONE ? null : certificationId,
        domainId: domainId === NONE ? null : domainId,
        topicId: topicId === NONE ? null : topicId,
        examId: examId === NONE ? null : examId,
      };
      if (isEdit && editing) {
        return updateDocument(editing.id, shared);
      }
      if (!file) throw new Error("Please choose a file to upload.");
      return uploadDocument({ ...shared, file });
    },
    onSuccess: () => {
      notify.success(isEdit ? "Document updated." : "Document uploaded.");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit document" : "Upload document"}
      description={
        isEdit
          ? "Update this document's details."
          : "Share study notes, guides or other materials with trainers or students."
      }
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            loading={mutation.isPending}
            loadingText={isEdit ? "Saving…" : "Uploading…"}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!title.trim() || (!isEdit && !file)}
          >
            {isEdit ? "Save changes" : "Upload"}
          </PrimaryButton>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {error ? <p className="text-sm font-medium text-destructive-ink">{error}</p> : null}

        {!isEdit ? (
          <Field id="document-file" label="File" required hint="PDF, Word, PowerPoint, Excel, text, Markdown or image, up to 25 MB.">
            {({ id, describedBy }) => (
              <input
                id={id}
                type="file"
                aria-describedby={describedBy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-md border border-border bg-background text-sm file:mr-4 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium"
              />
            )}
          </Field>
        ) : null}

        <TextField
          id="document-title"
          label="Title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Field id="document-description" label="Description">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="document-folder"
            label="Folder"
            options={folderOptions}
            value={folderId}
            onValueChange={setFolderId}
          />
          <SelectField
            id="document-category"
            label="Category"
            options={DOCUMENT_CATEGORY_OPTIONS}
            value={category}
            onValueChange={(value) => setCategory(value as DocumentCategory)}
          />
          <SelectField
            id="document-visibility"
            label="Visibility"
            options={DOCUMENT_VISIBILITY_OPTIONS}
            value={visibility}
            onValueChange={(value) => setVisibility(value as DocumentVisibility)}
            hint="Who can see and download this document."
          />
          <TextField
            id="document-tags"
            label="Tags"
            placeholder="e.g. entra-id, week-1"
            hint="Comma-separated."
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <SelectField
            id="document-certification"
            label="Certification"
            options={certificationOptions}
            value={certificationId}
            onValueChange={(value) => {
              setCertificationId(value);
              setDomainId(NONE);
              setTopicId(NONE);
            }}
          />
          <SelectField
            id="document-domain"
            label="Domain"
            options={domainOptions}
            value={domainId}
            onValueChange={(value) => {
              setDomainId(value);
              setTopicId(NONE);
            }}
          />
          <SelectField
            id="document-topic"
            label="Topic"
            options={topicOptions}
            value={topicId}
            onValueChange={setTopicId}
          />
          <SelectField
            id="document-exam"
            label="Exam"
            options={examOptions}
            value={examId}
            onValueChange={setExamId}
            hint="Required for exam-assigned visibility."
          />
        </div>
      </form>
    </Modal>
  );
}
