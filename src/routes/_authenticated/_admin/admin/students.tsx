import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  DataTable,
  ErrorState,
  LoadingBlock,
  StatusBadge,
  TextField,
} from "@/features/shared/components/ui";
import { listStudents, type StudentRow } from "@/features/admin/services/platform-stats-service";

export const Route = createFileRoute("/_authenticated/_admin/admin/students")({
  head: () => ({
    meta: [
      { title: "Students — AskMeExam admin" },
      { name: "description", content: "Registered accounts and their platform roles." },
      { property: "og:title", content: "Students — AskMeExam admin" },
      { property: "og:description", content: "Registered accounts and platform roles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const [search, setSearch] = React.useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-students"], queryFn: () => listStudents() });

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (row) =>
      term === "" ||
      (row.email ?? "").toLowerCase().includes(term) ||
      (row.full_name ?? "").toLowerCase().includes(term),
  );

  return (
    <PageShell title="Students" description="Registered accounts, newest first.">
      <TextField
        id="student-search"
        label="Search students"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Name or email address"
      />
      <div className="mt-6">
        {error ? (
          <ErrorState
            title="Students unavailable"
            description={error instanceof Error ? error.message : "Could not load accounts."}
          />
        ) : isLoading ? (
          <LoadingBlock label="Loading students" />
        ) : (
          <DataTable<StudentRow>
            caption="Registered accounts"
            rows={rows}
            getRowId={(row) => row.id}
            emptyMessage="No accounts match your search."
            columns={[
              { key: "name", header: "Name", render: (row) => row.full_name ?? "—" },
              { key: "email", header: "Email", render: (row) => row.email ?? "—" },
              {
                key: "role",
                header: "Role",
                render: (row) => (
                  <StatusBadge tone={row.isAdmin ? "info" : "neutral"}>
                    {row.isAdmin ? "Administrator" : "Student"}
                  </StatusBadge>
                ),
              },
              {
                key: "joined",
                header: "Joined",
                render: (row) => new Date(row.created_at).toLocaleDateString(),
              },
            ]}
          />
        )}
      </div>
    </PageShell>
  );
}
