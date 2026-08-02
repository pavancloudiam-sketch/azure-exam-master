import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  ClipboardList,
  HelpCircle,
  Layers,
  ListTree,
  Lock,
  Receipt,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import { LoadingBlock, SurfaceCard } from "@/features/shared/components/ui";
import { listAuditLogs } from "@/features/admin/services/audit-service";

const cards = [
  {
    to: "/admin/certifications",
    title: "Certifications",
    description: "Create, edit and activate certification programmes.",
    icon: BookOpen,
  },
  {
    to: "/admin/domains",
    title: "Domains",
    description: "Manage the domains that belong to a certification.",
    icon: Layers,
  },
  {
    to: "/admin/topics",
    title: "Topics",
    description: "Manage the topics that belong to a domain.",
    icon: ListTree,
  },
  {
    to: "/admin/questions",
    title: "Questions",
    description: "Author questions, set correct answers and assign them to exams.",
    icon: HelpCircle,
  },
  {
    to: "/admin/exams",
    title: "Exams",
    description: "Configure exams, publish them and manage the questions they deliver.",
    icon: ClipboardList,
  },
  {
    to: "/admin/import",
    title: "Bulk import",
    description: "Upload CSV or Excel question files and stage them for review.",
    icon: Upload,
  },
  {
    to: "/admin/ai",
    title: "AskMe AI",
    description: "Enable or disable each AskMe AI module independently.",
    icon: Sparkles,
  },
  {
    to: "/admin/ai/generator",
    title: "AI Question Generator",
    description: "Draft original practice questions for review before they enter the bank.",
    icon: Sparkles,
  },
  {
    to: "/admin/billing",
    title: "Billing operations",
    description: "Review refunds, watch the message queue and create test-mode orders.",
    icon: Receipt,
  },
  {
    to: "/admin/organizations",
    title: "Organisations",
    description: "Create enterprise tenants, invite members and manage organisation access.",
    icon: Building2,
  },
  {
    to: "/admin/privacy",
    title: "Data rights and retention",
    description: "Review deletion requests and set how long operational data is kept.",
    icon: Lock,
  },
  {
    to: "/admin/settings",
    title: "Application settings",
    description: "Branding, support contact, version and default exam values.",
    icon: Settings,
  },
] as const;

function AdminHome() {
  const audit = useQuery({ queryKey: ["audit-logs"], queryFn: () => listAuditLogs(10) });

  return (
    <PageShell
      title="Admin"
      description="Manage AskMeExam content taxonomy and review recent administrative activity."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-lg border border-border bg-card p-5 shadow-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <card.icon className="size-5 text-accent-ink" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          </Link>
        ))}
      </div>

      <SurfaceCard className="mt-8">
        <h2 className="text-lg font-semibold">Recent admin activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The ten most recent recorded administrative actions.
        </p>
        <div className="mt-4">
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
        </div>
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
