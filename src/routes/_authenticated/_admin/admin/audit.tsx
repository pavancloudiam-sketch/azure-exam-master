import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import { DataTable, ErrorState, LoadingBlock } from "@/features/shared/components/ui";
import { listAuditLogs } from "@/features/admin/services/audit-service";

type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>[number];

export const Route = createFileRoute("/_authenticated/_admin/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit logs — AskMeExam admin" },
      { name: "description", content: "Recorded administrative actions across the platform." },
      { property: "og:title", content: "Audit logs — AskMeExam admin" },
      { property: "og:description", content: "Recorded administrative actions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs", "full"],
    queryFn: () => listAuditLogs(200),
  });

  return (
    <PageShell
      title="Audit logs"
      description="Every recorded administrative action, newest first."
    >
      {error ? (
        <ErrorState
          title="Audit log unavailable"
          description={error instanceof Error ? error.message : "Could not load the audit log."}
        />
      ) : isLoading ? (
        <LoadingBlock label="Loading audit log" />
      ) : (
        <DataTable<AuditRow>
          caption="Administrative actions"
          rows={data ?? []}
          getRowId={(row) => row.id}
          emptyMessage="No admin actions recorded yet."
          columns={[
            { key: "action", header: "Action", render: (row) => row.action },
            { key: "entity", header: "Entity", render: (row) => row.entity_type },
            { key: "label", header: "Item", render: (row) => row.entity_label },
            {
              key: "at",
              header: "When",
              render: (row) => new Date(row.created_at).toLocaleString(),
            },
          ]}
        />
      )}
    </PageShell>
  );
}
