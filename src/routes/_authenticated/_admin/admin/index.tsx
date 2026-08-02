import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  ClipboardList,
  FileQuestion,
  FileText,
  HelpCircle,
  Layers,
  ListTree,
  Lock,
  Receipt,
  Settings,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import { LoadingBlock, StatCard, SurfaceCard } from "@/features/shared/components/ui";
import { listAuditLogs } from "@/features/admin/services/audit-service";
import { getPlatformStats } from "@/features/admin/services/platform-stats-service";

const groups = [
  {
    heading: "Content",
    cards: [
      { to: "/admin/certifications", title: "Certifications", description: "Create, edit and activate programmes.", icon: BookOpen },
      { to: "/admin/domains", title: "Domains", description: "Domains belonging to a certification.", icon: Layers },
      { to: "/admin/topics", title: "Topics", description: "Topics belonging to a domain.", icon: ListTree },
      { to: "/admin/questions", title: "Questions", description: "Author questions and set correct answers.", icon: FileQuestion },
      { to: "/admin/exams", title: "Exams", description: "Configure, publish and assemble exams.", icon: ClipboardList },
      { to: "/admin/import", title: "Bulk import", description: "Upload CSV or Excel question files.", icon: Upload },
      { to: "/admin/documents", title: "Documents", description: "Share study material securely.", icon: FileText },
    ],
  },
  {
    heading: "AI tools",
    cards: [
      { to: "/admin/ai/generator", title: "AI question generator", description: "Draft original questions for review.", icon: Sparkles },
      { to: "/admin/ai", title: "AI modules", description: "Enable or disable each AskMe AI module.", icon: Sparkles },
    ],
  },
  {
    heading: "People and operations",
    cards: [
      { to: "/admin/students", title: "Students", description: "Registered accounts and platform roles.", icon: Users },
      { to: "/admin/organizations", title: "Organisations", description: "Enterprise tenants and members.", icon: Building2 },
      { to: "/admin/billing", title: "Billing operations", description: "Refunds, queue health and test orders.", icon: Receipt },
      { to: "/admin/privacy", title: "Data rights", description: "Deletion requests and retention.", icon: Lock },
      { to: "/admin/settings", title: "Application settings", description: "Branding, support contact and defaults.", icon: Settings },
      { to: "/admin/audit", title: "Audit logs", description: "Every recorded administrative action.", icon: HelpCircle },
    ],
  },
] as const;

function AdminHome() {
  const audit = useQuery({ queryKey: ["audit-logs"], queryFn: () => listAuditLogs(8) });
  const stats = useQuery({ queryKey: ["platform-stats"], queryFn: getPlatformStats, staleTime: 60_000 });

  return (
    <PageShell
      title="Admin dashboard"
      description="Content, people and operations for AskMeExam in one place."
    >
      <section aria-label="Platform totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Certifications" value={stats.data?.certifications ?? "—"} icon={BookOpen} />
        <StatCard
          label="Exams"
          value={stats.data?.exams ?? "—"}
          hint={stats.data ? `${stats.data.publishedExams} published` : undefined}
          icon={ClipboardList}
        />
        <StatCard label="Questions" value={stats.data?.questions ?? "—"} icon={FileQuestion} />
        <StatCard
          label="Registered students"
          value={stats.data?.students ?? "—"}
          hint={stats.data ? `${stats.data.attempts} attempts recorded` : undefined}
          icon={Users}
        />
      </section>

      {groups.map((group) => (
        <section key={group.heading} className="mt-10" aria-labelledby={`group-${group.heading}`}>
          <h2 id={`group-${group.heading}`} className="text-lg font-semibold">
            {group.heading}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.cards.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <card.icon className="size-5 text-accent-ink" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">{card.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <SurfaceCard
        className="mt-10"
        title="Recent admin activity"
        description="The most recent recorded administrative actions."
        actions={
          <Link to="/admin/audit" className="text-sm font-medium text-accent-ink hover:underline">
            View all
          </Link>
        }
      >
        {audit.isLoading ? (
          <LoadingBlock label="Loading audit log" />
        ) : audit.data && audit.data.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {audit.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground">{entry.entity_label}</span>
                <time dateTime={entry.created_at} className="text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
        )}
      </SurfaceCard>
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — AskMeExam" },
      { name: "description", content: "AskMeExam content administration overview." },
      { property: "og:title", content: "Admin — AskMeExam" },
      { property: "og:description", content: "AskMeExam content administration overview." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});
