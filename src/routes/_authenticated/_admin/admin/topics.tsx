import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ConfirmDialog,
  DataTable,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  StatusBadge,
  notify,
  type Column,
} from "@/features/shared/components/ui";
import { EntityFormModal, type FieldDef } from "@/features/admin/components/EntityFormModal";
import { TaxonomyToolbar } from "@/features/admin/components/TaxonomyToolbar";
import {
  createTopic,
  listDomains,
  listTopics,
  setTopicActive,
  updateTopic,
} from "@/features/admin/services/taxonomy-service";
import { topicSchema, type TopicInput } from "@/features/admin/validation/taxonomy-schemas";
import type { ActiveFilter, Topic } from "@/features/admin/types/taxonomy";

function TopicsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ActiveFilter>("all");
  const [domainFilter, setDomainFilter] = React.useState("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Topic | null>(null);
  const [pendingToggle, setPendingToggle] = React.useState<Topic | null>(null);

  const domains = useQuery({ queryKey: ["domains"], queryFn: listDomains });
  const query = useQuery({ queryKey: ["topics"], queryFn: listTopics });

  const domainOptions = (domains.data ?? []).map((domain) => ({
    value: domain.id,
    label: domain.is_active ? domain.name : `${domain.name} (inactive)`,
  }));

  const domainName = (id: string) => domains.data?.find((d) => d.id === id)?.name ?? "—";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["topics"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const save = useMutation({
    mutationFn: async (input: TopicInput) =>
      editing ? updateTopic(editing.id, input) : createTopic(input),
    onSuccess: () => {
      notify.success(editing ? "Topic updated" : "Topic created");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: Topic) => setTopicActive(row, !row.is_active),
    onSuccess: (_data, row) => {
      notify.success(row.is_active ? "Topic deactivated" : "Topic activated");
      invalidate();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const rows = (query.data ?? []).filter((row) => {
    const matchesSearch = !search || row.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      status === "all" || (status === "active" ? row.is_active : !row.is_active);
    const matchesDomain = domainFilter === "all" || row.domain_id === domainFilter;
    return matchesSearch && matchesStatus && matchesDomain;
  });

  const fields: FieldDef[] = [
    { name: "domain_id", label: "Domain", type: "select", required: true, options: domainOptions },
    { name: "name", label: "Topic name", type: "text", required: true },
    { name: "sort_order", label: "Sort order", type: "number", required: true },
  ];

  const columns: Column<Topic>[] = [
    { key: "name", header: "Topic", render: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: "domain",
      header: "Domain",
      render: (row) => <span className="text-muted-foreground">{domainName(row.domain_id)}</span>,
    },
    { key: "sort", header: "Order", render: (row) => row.sort_order },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Active" : "Inactive"}
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
          <SecondaryButton size="sm" onClick={() => setPendingToggle(row)}>
            {row.is_active ? "Deactivate" : "Activate"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  const initialValues = {
    domain_id: editing?.domain_id ?? domains.data?.[0]?.id ?? "",
    name: editing?.name ?? "",
    sort_order: String(editing?.sort_order ?? 0),
  };

  return (
    <PageShell title="Topics" description="Topics belong to a domain.">
      <div className="space-y-6">
        <StatusAlert tone="info" title="Deactivation is reversible">
          Topics are never deleted. Questions already linked to a topic and any completed attempts
          keep their history when a topic is deactivated.
        </StatusAlert>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TaxonomyToolbar
            searchId="topic-search"
            searchLabel="Search topics"
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
          >
            <div className="sm:w-64">
              <SelectField
                id="topic-domain-filter"
                label="Domain"
                value={domainFilter}
                onValueChange={setDomainFilter}
                options={[{ value: "all", label: "All domains" }, ...domainOptions]}
              />
            </div>
          </TaxonomyToolbar>
          <PrimaryButton
            disabled={domainOptions.length === 0}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add topic
          </PrimaryButton>
        </div>

        {query.isLoading ? (
          <LoadingBlock label="Loading topics" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load topics"
            description={(query.error as Error).message}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            caption="Topics"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            emptyMessage="No topics match the current filters."
          />
        )}
      </div>

      <EntityFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit topic" : "Add topic"}
        fields={fields}
        schema={topicSchema}
        initialValues={initialValues}
        submitLabel={editing ? "Save changes" : "Create topic"}
        onSubmit={async (values) => {
          await save.mutateAsync(values as TopicInput);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => !open && setPendingToggle(null)}
        title={pendingToggle?.is_active ? "Deactivate topic?" : "Activate topic?"}
        description={
          pendingToggle?.is_active
            ? "The topic will be hidden from students. Existing questions, attempts and results are preserved."
            : "The topic becomes visible to students when its domain and certification are active."
        }
        confirmLabel={pendingToggle?.is_active ? "Deactivate" : "Activate"}
        {...(pendingToggle?.is_active ? { tone: "destructive" as const } : {})}
        onConfirm={() => {
          if (pendingToggle) toggle.mutate(pendingToggle);
          setPendingToggle(null);
        }}
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/topics")({
  head: () => ({
    meta: [
      { title: "Topics — AskMeExam Admin" },
      { name: "description", content: "Manage AskMeExam domain topics." },
      { property: "og:title", content: "Topics — AskMeExam Admin" },
      { property: "og:description", content: "Manage AskMeExam domain topics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TopicsPage,
});