import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ConfirmDialog,
  DataTable,
  ErrorState,
  LoadingBlock,
  PaginationControls,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  TextField,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import {
  ExamFormModal,
  emptyExamValues,
  examToValues,
  type ExamFormValues,
} from "@/features/admin/components/ExamFormModal";
import { ExamQuestionsModal } from "@/features/admin/components/ExamQuestionsModal";
import {
  addQuestionToExam,
  createExam,
  listAdminExams,
  listAssignableQuestions,
  listExamAssignments,
  removeQuestionFromExamById,
  reorderExamQuestions,
  setExamActive,
  setExamPublished,
  updateExam,
} from "@/features/admin/services/exam-admin-service";
import { listCertifications } from "@/features/admin/services/taxonomy-service";
import { useAppSettings } from "@/features/shared/hooks/use-app-settings";
import type { ExamInput } from "@/features/admin/validation/exam-schemas";
import type { Exam, Question } from "@/features/admin/types/questions";

const PAGE_SIZE = 10;

function ExamsAdminPage() {
  const queryClient = useQueryClient();
  const appSettings = useAppSettings();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "active" | "inactive">("all");
  const [published, setPublished] = React.useState<"all" | "published" | "unpublished">("all");
  const [page, setPage] = React.useState(1);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Exam | null>(null);
  const [questionsFor, setQuestionsFor] = React.useState<Exam | null>(null);
  const [questionSearch, setQuestionSearch] = React.useState("");
  const [pendingActive, setPendingActive] = React.useState<Exam | null>(null);
  const [pendingPublish, setPendingPublish] = React.useState<Exam | null>(null);

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const exams = useQuery({ queryKey: ["admin-exams"], queryFn: listAdminExams });

  const assignments = useQuery({
    queryKey: ["exam-assignments", questionsFor?.id],
    queryFn: () => listExamAssignments(questionsFor!.id),
    enabled: Boolean(questionsFor),
  });

  const candidates = useQuery({
    queryKey: ["assignable-questions", questionsFor?.certification_id, questionSearch],
    queryFn: () => listAssignableQuestions(questionsFor!.certification_id, questionSearch),
    enabled: Boolean(questionsFor),
  });

  const certificationOptions = (certifications.data ?? []).map((row) => ({
    value: row.id,
    label: row.is_active ? `${row.name} ${row.version}` : `${row.name} ${row.version} (inactive)`,
  }));

  const certificationName = (id: string) =>
    certifications.data?.find((row) => row.id === id)?.name ?? "—";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
    void queryClient.invalidateQueries({ queryKey: ["published-exams"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const invalidateAssignments = () => {
    void queryClient.invalidateQueries({ queryKey: ["exam-assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["assignable-questions"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const save = useMutation({
    mutationFn: async (input: ExamInput) =>
      editing ? updateExam(editing.id, input) : createExam(input),
    onSuccess: () => {
      notify.success(editing ? "Exam updated" : "Exam created");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (exam: Exam) => setExamActive(exam, !exam.is_active),
    onSuccess: (_data, exam) => {
      notify.success(exam.is_active ? "Exam deactivated" : "Exam activated");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const togglePublished = useMutation({
    mutationFn: async (exam: Exam) => setExamPublished(exam, !exam.is_published),
    onSuccess: (_data, exam) => {
      notify.success(exam.is_published ? "Exam unpublished" : "Exam published");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const addQuestion = useMutation({
    mutationFn: async (question: Question) => addQuestionToExam(questionsFor!, question),
    onSuccess: () => {
      notify.success("Question assigned");
      invalidateAssignments();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const removeQuestion = useMutation({
    mutationFn: async (questionId: string) =>
      removeQuestionFromExamById(questionsFor!, questionId),
    onSuccess: () => {
      notify.success("Question removed from future deliveries");
      invalidateAssignments();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: async (orderedRowIds: string[]) =>
      reorderExamQuestions(questionsFor!, orderedRowIds),
    onSuccess: () => {
      notify.success("Order updated");
      invalidateAssignments();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const filtered = (exams.data ?? []).filter((exam) => {
    const matchesSearch =
      !search ||
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      (exam.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      status === "all" || (status === "active" ? exam.is_active : !exam.is_active);
    const matchesPublished =
      published === "all" || (published === "published" ? exam.is_published : !exam.is_published);
    return matchesSearch && matchesStatus && matchesPublished;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const columns: Column<Exam>[] = [
    {
      key: "title",
      header: "Exam",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {certificationName(row.certification_id)}
          </p>
        </div>
      ),
    },
    {
      key: "config",
      header: "Configuration",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.question_count} questions · pass {row.passing_score}/1000 ·{" "}
          {row.time_limit_minutes ? `${row.time_limit_minutes} min` : "no limit"}
        </span>
      ),
    },
    {
      key: "modes",
      header: "Modes",
      render: (row) => (
        <div className="flex gap-1">
          {row.allow_timed ? <StatusBadge tone="info">Timed</StatusBadge> : null}
          {row.allow_practice ? <StatusBadge tone="neutral">Practice</StatusBadge> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex gap-1">
          <StatusBadge tone={row.is_active ? "success" : "neutral"}>
            {row.is_active ? "Active" : "Inactive"}
          </StatusBadge>
          <StatusBadge tone={row.is_published ? "success" : "warning"}>
            {row.is_published ? "Published" : "Draft"}
          </StatusBadge>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton
            size="sm"
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
          >
            Edit
          </SecondaryButton>
          <SecondaryButton
            size="sm"
            onClick={() => {
              setQuestionSearch("");
              setQuestionsFor(row);
            }}
          >
            Questions
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingActive(row)}>
            {row.is_active ? "Deactivate" : "Activate"}
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingPublish(row)}>
            {row.is_published ? "Unpublish" : "Publish"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  const initialValues: ExamFormValues = editing
    ? examToValues(editing)
    : emptyExamValues(certificationOptions[0]?.value ?? "", {
        // New exams start from the platform defaults; existing exams keep their own values.
        passingScore: appSettings.default_passing_scaled_score,
        durationMinutes: appSettings.default_exam_duration_minutes,
      });

  return (
    <PageShell
      title="Exams"
      description="Configure exams, control availability and manage the questions each exam delivers."
    >
      <div className="space-y-6">
        <StatusAlert tone="info" title="Exams are never deleted">
          Deactivating or unpublishing an exam hides it from students. Attempts already started or
          submitted stay intact and reviewable.
        </StatusAlert>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            <TextField
              id="exam-search"
              label="Search exams"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by title"
            />
            <SelectField
              id="exam-status-filter"
              label="Status"
              value={status}
              onValueChange={(next) => {
                setStatus(next as typeof status);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <SelectField
              id="exam-published-filter"
              label="Publication"
              value={published}
              onValueChange={(next) => {
                setPublished(next as typeof published);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All" },
                { value: "published", label: "Published" },
                { value: "unpublished", label: "Draft" },
              ]}
            />
          </div>
          <PrimaryButton
            disabled={certificationOptions.length === 0}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add exam
          </PrimaryButton>
        </div>

        {exams.isLoading ? (
          <LoadingBlock label="Loading exams" />
        ) : exams.isError ? (
          <ErrorState
            title="Could not load exams"
            description={(exams.error as Error).message}
            onRetry={() => void exams.refetch()}
          />
        ) : (
          <>
            <DataTable
              caption="Exams"
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              emptyMessage="No exams match the current filters."
            />
            <PaginationControls
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              totalItems={filtered.length}
            />
          </>
        )}
      </div>

      <ExamFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit exam" : "Add exam"}
        certificationOptions={certificationOptions}
        initialValues={initialValues}
        submitLabel={editing ? "Save exam" : "Create exam"}
        onSubmit={async (input) => {
          await save.mutateAsync(input);
        }}
      />

      <ExamQuestionsModal
        open={Boolean(questionsFor)}
        onOpenChange={(next) => {
          if (!next) setQuestionsFor(null);
        }}
        exam={questionsFor}
        assignments={assignments.data ?? []}
        loading={assignments.isLoading}
        candidates={candidates.data ?? []}
        search={questionSearch}
        onSearchChange={setQuestionSearch}
        onAdd={async (question) => {
          await addQuestion.mutateAsync(question);
        }}
        onRemove={async (questionId) => {
          await removeQuestion.mutateAsync(questionId);
        }}
        onReorder={async (orderedRowIds) => {
          await reorder.mutateAsync(orderedRowIds);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingActive)}
        onOpenChange={(next) => {
          if (!next) setPendingActive(null);
        }}
        title={pendingActive?.is_active ? "Deactivate exam?" : "Activate exam?"}
        description={
          pendingActive?.is_active
            ? "Students will no longer be able to start this exam. Existing attempts and results are unaffected."
            : "The exam becomes startable again once it is also published and has at least one active question."
        }
        confirmLabel={pendingActive?.is_active ? "Deactivate" : "Activate"}
        onConfirm={() => {
          if (pendingActive) toggleActive.mutate(pendingActive);
          setPendingActive(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPublish)}
        onOpenChange={(next) => {
          if (!next) setPendingPublish(null);
        }}
        title={pendingPublish?.is_published ? "Unpublish exam?" : "Publish exam?"}
        description={
          pendingPublish?.is_published
            ? "The exam is withdrawn from the student catalogue. History is preserved."
            : "Students will see the exam once it is active, published and contains at least one active question."
        }
        confirmLabel={pendingPublish?.is_published ? "Unpublish" : "Publish"}
        onConfirm={() => {
          if (pendingPublish) togglePublished.mutate(pendingPublish);
          setPendingPublish(null);
        }}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/exams")({
  head: () => ({
    meta: [
      { title: "Exam administration — AskMeExam" },
      {
        name: "description",
        content: "Create, configure, publish and staff AskMeExam practice exams with questions.",
      },
      { property: "og:title", content: "Exam administration — AskMeExam" },
      {
        property: "og:description",
        content: "Create, configure and publish AskMeExam practice exams.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamsAdminPage,
});