import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { StatusBadge, SurfaceCard } from "@/features/shared/components/ui";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AttemptHistory } from "@/features/results/components/AttemptHistory";

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
  const { user, isAdmin } = useAuth();
  return (
    <PageShell
      title="Dashboard"
      description="Available practice exams and your recent attempts will appear here."
    >
      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Signed in as</span>
          <span className="text-sm font-medium">{user?.email}</span>
          <StatusBadge tone={isAdmin ? "info" : "neutral"}>
            {isAdmin ? "admin" : "student"}
          </StatusBadge>
        </div>
      </SurfaceCard>
      <div className="mt-6">
        <Link
          to="/exams"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Browse practice exams
        </Link>
      </div>

      <section className="mt-10" aria-labelledby="attempts-heading">
        <h2 id="attempts-heading" className="mb-3 text-lg font-semibold">
          Recent attempts
        </h2>
        <AttemptHistory />
      </section>
    </PageShell>
  );
}