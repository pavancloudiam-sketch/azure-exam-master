import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { StudentDashboard } from "@/features/dashboard/components/StudentDashboard";
import { useAuth } from "@/features/auth/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AskMeExam" },
      { name: "description", content: "Your Microsoft Entra ID practice exams and attempts." },
      { property: "og:title", content: "Dashboard — AskMeExam" },
      { property: "og:description", content: "Your practice exams and recent attempts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const name = user?.email?.split("@")[0] ?? "there";
  return (
    <PageShell
      title="Dashboard"
      description={`Welcome back, ${name}. Here is your practice progress and what to do next.`}
    >
      <StudentDashboard />
    </PageShell>
  );
}
