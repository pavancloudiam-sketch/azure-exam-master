import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, LineChart, ShieldCheck, Sparkles, Timer } from "lucide-react";

import { useAppSettings } from "../features/shared/hooks/use-app-settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AskMeExam — Microsoft Entra ID Practice Exams" },
      {
        name: "description",
        content:
          "Prepare for Microsoft Entra ID certification with independent, exam-realistic practice tests, full explanations and per-domain performance insights.",
      },
      { property: "og:title", content: "AskMeExam — Microsoft Entra ID Practice Exams" },
      {
        property: "og:description",
        content: "Independent Microsoft Entra ID certification practice exams with full reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Timer,
    title: "Timed mock exams",
    copy: "A server-authoritative countdown, automatic submission and scaled scoring that mirrors the real sitting.",
  },
  {
    icon: Clock3,
    title: "Untimed practice",
    copy: "The same question engine without the clock, so you can think a question through properly.",
  },
  {
    icon: LineChart,
    title: "Per-domain insight",
    copy: "See exactly which certification domains are costing you marks, attempt after attempt.",
  },
  {
    icon: Sparkles,
    title: "AI study assistant",
    copy: "Turn weak domains into a focused revision plan, and rehearse with the interview coach.",
  },
  {
    icon: ShieldCheck,
    title: "Original content only",
    copy: "Every question is written in-house. No exam dumps, no recycled material, no shortcuts.",
  },
  {
    icon: CheckCircle2,
    title: "Full explanations",
    copy: "Each answer comes with a written rationale so a wrong answer becomes something you learn.",
  },
];

function Index() {
  const settings = useAppSettings();
  return (
    <main className="flex-1">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center lg:py-28">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-accent-ink">
              Microsoft Entra ID practice
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {settings.tagline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              {settings.application_name} is an independent practice platform for Microsoft Entra ID
              certification preparation — realistic question formats, timed mocks, untimed practice
              and a full review of every answer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "register" }}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start practising free
              </Link>
              <Link
                to="/certifications"
                className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-6 text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                Browse certifications
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No card required. Independent platform — not affiliated with Microsoft.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-semibold text-muted-foreground">What an attempt looks like</p>
            <ul className="mt-4 space-y-4 text-sm">
              {[
                "Question palette with flagged and unanswered markers",
                "Autosave with an offline queue you can trust",
                "Scaled score and pass decision on submission",
                "Per-domain breakdown and a full answer review",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-ink" aria-hidden="true" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Everything you need between now and exam day
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <feature.icon className="size-5 text-accent-ink" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Ready for your first mock?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account and sit a full practice exam in the next ten minutes.
            </p>
          </div>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
