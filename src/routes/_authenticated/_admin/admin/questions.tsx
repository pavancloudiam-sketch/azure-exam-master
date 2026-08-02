import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
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
import { BulkActionBar } from "@/features/admin/components/BulkActionBar";
import {
  QuestionFormModal,
  emptyQuestionValues,
  questionToValues,
  type QuestionFormValues,
} from "@/features/admin/components/QuestionFormModal";
import { AssignExamModal } from "@/features/admin/components/AssignExamModal";
import { listDomains, listTopics, listCertifications } from "@/features/admin/services/taxonomy-service";
import {
  applyBulkAction,
  assignQuestionToExam,
  createQuestion,
  fetchQuestionStats,
  listExamQuestions,
  listExams,
  listImportBatches,
  removeQuestionFromExam,
  searchQuestions,
  setQuestionActive,
  updateQuestion,
  type BulkAction,
} from "@/features/admin/services/question-service";
import type { QuestionInput } from "@/features/admin/validation/question-schemas";
import {
  DIFFICULTY_LABELS,
  GOVERNANCE_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
  type Difficulty,
  type GovernanceStatus,
  type QuestionType,
  type QuestionWithOptions,
} from "@/features/admin/types/questions";

const PAGE_SIZE = 20;

function QuestionsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [activeStatus, setActiveStatus] = React.useState<"all" | "active" | "inactive" | "archived">(
    "all",
  );
  const [certificationFilter, setCertificationFilter] = React.useState("all");
  const [domainFilter, setDomainFilter] = React.useState("all");
  const [topicFilter, setTopicFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [difficultyFilter, setDifficultyFilter] = React.useState("all");
  const [governanceFilter, setGovernanceFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("");
  const [reviewFilter, setReviewFilter] = React.useState<"all" | "flagged" | "clear">("all");
  const [batchFilter, setBatchFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<string[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<QuestionWithOptions | null>(null);
  const [pendingToggle, setPendingToggle] = React.useState<QuestionWithOptions | null>(null);
  const [assigning, setAssigning] = React.useState<QuestionWithOptions | null>(null);

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const domains = useQuery({ queryKey: ["domains"], queryFn: listDomains });
  const topics = useQuery({ queryKey: ["topics"], queryFn: listTopics });
  const exams = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const batches = useQuery({ queryKey: ["import-batches"], queryFn: listImportBatches });

  // Domain filtering resolves to the topics inside that domain, which keeps the
  // question query itself a single indexed lookup.
  const topicIdsForDomain =
    domainFilter === "all"
      ? null
      : (topics.data ?? []).filter((row) => row.domain_id === domainFilter).map((row) => row.id);

  const params = {
    search,
    certificationId: certificationFilter,
    topicIds: topicIdsForDomain,
    topicId: topicFilter,
    difficulty: difficultyFilter,
    questionType: typeFilter,
    governanceStatus: governanceFilter,
    activeStatus,
    tag: tagFilter,
    reviewFlag: reviewFilter,
    importBatchId: batchFilter,
    page,
    pageSize: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: ["questions", params],
    queryFn: () => searchQuestions(params),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIds = rows.map((row) => row.id);

  // Assignments are fetched only for the questions on the current page.
  const assignments = useQuery({
    queryKey: ["exam-questions", pageIds],
    queryFn: () => listExamQuestions(pageIds),
    enabled: pageIds.length > 0,
    placeholderData: keepPreviousData,
  });

  const stats = useQuery({
    queryKey: ["question-stats", pageIds],
    queryFn: () => fetchQuestionStats(pageIds),
    enabled: pageIds.length > 0,
  });

  React.useEffect(() => {
    setPage(1);
  }, [
    search,
    activeStatus,
    certificationFilter,
    domainFilter,
    topicFilter,
    typeFilter,
    difficultyFilter,
    governanceFilter,
    tagFilter,
    reviewFilter,
    batchFilter,
  ]);

  const topicById = (id: string | null) => topics.data?.find((t) => t.id === id);
  const domainOfTopic = (id: string | null) => {
    const topic = topicById(id);
    return topic ? domains.data?.find((d) => d.id === topic.domain_id) : undefined;
  };

  const certificationOptions = (certifications.data ?? []).map((row) => ({
    value: row.id,
    label: row.is_active ? row.name : `${row.name} (inactive)`,
  }));

  const domainOptionsFor = (certificationId: string) =>
    (domains.data ?? [])
      .filter((row) => row.certification_id === certificationId)
      .map((row) => ({ value: row.id, label: row.is_active ? row.name : `${row.name} (inactive)` }));

  const topicOptionsFor = (domainId: string) =>
    (topics.data ?? [])
      .filter((row) => row.domain_id === domainId)
      .map((row) => ({ value: row.id, label: row.is_active ? row.name : `${row.name} (inactive)` }));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["questions"] });
    void queryClient.invalidateQueries({ queryKey: ["question-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const save = useMutation({
    mutationFn: async (input: QuestionInput) =>
      editing ? updateQuestion(editing.id, input) : createQuestion(input),
    onSuccess: () => {
      notify.success(editing ? "Question updated" : "Question created");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: QuestionWithOptions) => setQuestionActive(row, !row.is_active),
    onSuccess: (_data, row) => {
      notify.success(row.is_active ? "Question deactivated" : "Question activated");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const bulk = useMutation({
    mutationFn: async (action: BulkAction) => applyBulkAction(selected, action),
    onSuccess: (count) => {
      notify.success(`Updated ${count} question${count === 1 ? "" : "s"}`);
      setSelected([]);
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const assign = useMutation({
    mutationFn: async (vars: { examId: string; remove: boolean }) => {
      if (!assigning) return;
      return vars.remove
        ? removeQuestionFromExam(assigning, vars.examId)
        : assignQuestionToExam(assigning, vars.examId);
    },
    onSuccess: (_data, vars) => {
      notify.success(vars.remove ? "Removed from exam" : "Assigned to exam");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const columns: Column<QuestionWithOptions>[] = [
    {
      key: "select",
      header: "Select",
      className: "w-10",
      render: (row) => (
        <Checkbox
          checked={selected.includes(row.id)}
          aria-label={`Select question: ${row.stem.slice(0, 60)}`}
          onCheckedChange={(checked) =>
            setSelected((prev) =>
              checked ? [...new Set([...prev, row.id])] : prev.filter((id) => id !== row.id),
            )
          }
        />
      ),
    },
    {
      key: "stem",
      header: "Question",
      render: (row) => (
        <div className="max-w-md space-y-1">
          <p className="font-medium">{row.stem}</p>
          <p className="text-xs text-muted-foreground">
            {domainOfTopic(row.topic_id)?.name ?? "—"} · {topicById(row.topic_id)?.name ?? "—"}
          </p>
          {row.tags.length > 0 ? (
            <p className="text-xs text-muted-foreground">Tags: {row.tags.join(", ")}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => QUESTION_TYPE_LABELS[row.question_type as QuestionType] ?? row.question_type,
    },
    {
      key: "difficulty",
      header: "Difficulty",
      render: (row) => DIFFICULTY_LABELS[row.difficulty as Difficulty] ?? row.difficulty,
    },
    {
      key: "governance",
      header: "Governance",
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge tone={row.governance_status === "approved" ? "success" : "info"}>
            {GOVERNANCE_STATUS_LABELS[row.governance_status as GovernanceStatus] ??
              row.governance_status}
          </StatusBadge>
          {row.review_flag ? <StatusBadge tone="warning">Review flag</StatusBadge> : null}
        </div>
      ),
    },
    {
      key: "usage",
      header: "Usage",
      render: (row) => {
        const stat = stats.data?.get(row.id);
        return (
          <div className="text-xs text-muted-foreground">
            <p>{stat?.usage_count ?? 0} published exams</p>
            <p>{stat?.attempt_count ?? 0} submitted attempts</p>
            <p>
              Pass rate:{" "}
              {stat && stat.pass_rate !== null ? `${stat.pass_rate}%` : "no data"}
            </p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge
          tone={row.is_archived ? "warning" : row.is_active ? "success" : "neutral"}
        >
          {row.is_archived ? "Archived" : row.is_active ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            size="sm"
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
          >
            Edit
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setAssigning(row)}>
            Exams
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setPendingToggle(row)}>
            {row.is_active ? "Deactivate" : "Activate"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  const defaultCertification =
    certifications.data?.find((row) => row.is_active)?.id ?? certifications.data?.[0]?.id ?? "";

  const initialValues: QuestionFormValues = editing
    ? questionToValues(editing, domainOfTopic(editing.topic_id)?.id ?? "")
    : emptyQuestionValues(defaultCertification);

  return (
    <PageShell title="Questions" description="Author and maintain the reusable question bank.">
      <div className="space-y-6">
        <StatusAlert tone="info" title="Questions are never deleted">
          Deactivating or archiving a question removes it from future exam delivery only. Submitted
          attempts keep the question, its options and the explanation in their review data.
        </StatusAlert>

        <section aria-label="Search and filters" className="rounded-lg border border-border bg-card p-4">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <TextField
              id="question-search"
              label="Search questions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Question or scenario text"
            />
            <SelectField
              id="filter-certification"
              label="Certification"
              options={[
                { value: "all", label: "All certifications" },
                ...(certifications.data ?? []).map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={certificationFilter}
              onValueChange={setCertificationFilter}
            />
            <SelectField
              id="filter-domain"
              label="Domain"
              options={[
                { value: "all", label: "All domains" },
                ...(domains.data ?? []).map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={domainFilter}
              onValueChange={(next) => {
                setDomainFilter(next);
                setTopicFilter("all");
              }}
            />
            <SelectField
              id="filter-topic"
              label="Topic"
              options={[
                { value: "all", label: "All topics" },
                ...(topics.data ?? [])
                  .filter((row) => domainFilter === "all" || row.domain_id === domainFilter)
                  .map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={topicFilter}
              onValueChange={setTopicFilter}
            />
            <SelectField
              id="filter-difficulty"
              label="Difficulty"
              options={[
                { value: "all", label: "All difficulties" },
                ...(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => ({
                  value,
                  label: DIFFICULTY_LABELS[value],
                })),
              ]}
              value={difficultyFilter}
              onValueChange={setDifficultyFilter}
            />
            <SelectField
              id="filter-type"
              label="Question type"
              options={[
                { value: "all", label: "All types" },
                ...(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((value) => ({
                  value,
                  label: QUESTION_TYPE_LABELS[value],
                })),
              ]}
              value={typeFilter}
              onValueChange={setTypeFilter}
            />
            <SelectField
              id="filter-governance"
              label="Governance status"
              options={[
                { value: "all", label: "All governance states" },
                ...(Object.keys(GOVERNANCE_STATUS_LABELS) as GovernanceStatus[]).map((value) => ({
                  value,
                  label: GOVERNANCE_STATUS_LABELS[value],
                })),
              ]}
              value={governanceFilter}
              onValueChange={setGovernanceFilter}
            />
            <SelectField
              id="filter-active"
              label="Active status"
              options={[
                { value: "all", label: "Active and inactive" },
                { value: "active", label: "Active only" },
                { value: "inactive", label: "Inactive only" },
                { value: "archived", label: "Archived only" },
              ]}
              value={activeStatus}
              onValueChange={(next) => setActiveStatus(next as typeof activeStatus)}
            />
            <TextField
              id="filter-tag"
              label="Tag"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="e.g. conditional-access"
            />
            <SelectField
              id="filter-review"
              label="Review flag"
              options={[
                { value: "all", label: "Any review state" },
                { value: "flagged", label: "Flagged for review" },
                { value: "clear", label: "Not flagged" },
              ]}
              value={reviewFilter}
              onValueChange={(next) => setReviewFilter(next as typeof reviewFilter)}
            />
            <SelectField
              id="filter-batch"
              label="Import batch"
              options={[
                { value: "all", label: "Any origin" },
                ...(batches.data ?? []).map((row) => ({
                  value: row.id,
                  label: `${row.filename} · ${new Date(row.created_at).toLocaleDateString()}`,
                })),
              ]}
              value={batchFilter}
              onValueChange={setBatchFilter}
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="select-page"
              checked={allOnPageSelected}
              aria-label="Select every question on this page"
              onCheckedChange={(checked) =>
                setSelected((prev) =>
                  checked
                    ? [...new Set([...prev, ...pageIds])]
                    : prev.filter((id) => !pageIds.includes(id)),
                )
              }
            />
            <span>Select all on this page</span>
          </div>
          <PrimaryButton
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New question
          </PrimaryButton>
        </div>

        <BulkActionBar
          selectedCount={selected.length}
          domainOptions={(domains.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
          topicOptionsFor={topicOptionsFor}
          topicOptions={(topics.data ?? []).map((row) => ({
            value: row.id,
            label: `${domains.data?.find((d) => d.id === row.domain_id)?.name ?? "—"} · ${row.name}`,
          }))}
          onClearSelection={() => setSelected([])}
          onApply={async (action) => {
            await bulk.mutateAsync(action);
          }}
        />

        <StatusAlert tone="info" title="Statistics are descriptive">
          Usage, attempt counts and observed pass rates describe what has happened so far. They never
          change a question's difficulty, governance status or availability automatically.
        </StatusAlert>

        {query.isLoading ? (
          <LoadingBlock label="Loading questions…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load questions"
            description={(query.error as Error).message}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="space-y-4">
            <DataTable
              caption="Question bank"
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              emptyMessage="No questions match these filters."
            />
            <PaginationControls
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              totalItems={total}
            />
          </div>
        )}
      </div>

      <QuestionFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        initialValues={initialValues}
        certificationOptions={certificationOptions}
        domainOptions={domainOptionsFor}
        topicOptionsFor={topicOptionsFor}
        submitLabel={editing ? "Save question" : "Create question"}
        onSubmit={async (input) => {
          await save.mutateAsync(input);
        }}
      />

      <AssignExamModal
        open={Boolean(assigning)}
        onOpenChange={(open) => {
          if (!open) setAssigning(null);
        }}
        question={assigning}
        exams={exams.data ?? []}
        assignments={assignments.data ?? []}
        onAssign={async (examId) => {
          await assign.mutateAsync({ examId, remove: false });
        }}
        onRemove={async (examId) => {
          await assign.mutateAsync({ examId, remove: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        title={pendingToggle?.is_active ? "Deactivate question?" : "Activate question?"}
        description={
          pendingToggle?.is_active
            ? "The question stops being delivered in new exams. Existing attempt history is unchanged."
            : "The question becomes available for exam delivery again."
        }
        confirmLabel={pendingToggle?.is_active ? "Deactivate" : "Activate"}
        onConfirm={async () => {
          if (pendingToggle) await toggle.mutateAsync(pendingToggle);
          setPendingToggle(null);
        }}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/questions")({
  head: () => ({
    meta: [
      { title: "Question administration | AskMeExam" },
      {
        name: "description",
        content:
          "Search, bulk-manage and review usage statistics for the AskMeExam question bank.",
      },
      { property: "og:title", content: "Question administration | AskMeExam" },
      {
        property: "og:description",
        content: "Admin tools for bulk actions, filtering and question statistics in AskMeExam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuestionsPage,
});
