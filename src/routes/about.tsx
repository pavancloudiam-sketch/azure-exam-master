import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, LineChart, PlayCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How AskMeExam Works — Practice, Review, Improve" },
      {
        name: "description",
        content:
          "See how AskMeExam works: pick a certification, sit a timed or untimed practice exam, review every explanation and track your weak domains.",
      },
      { property: "og:title", content: "How AskMeExam Works — Practice, Review, Improve" },
      {
        property: "og:description",
        content: "Pick a certification, practise, review explanations and track weak domains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const steps = [
  {
    icon: ClipboardCheck,
    title: "1. Choose a certification",
    copy: "Browse the certification catalogue and see the domains, topics and exams covered before you start.",
  },
  {
    icon: PlayCircle,
    title: "2. Sit a practice exam",
    copy: "Run a timed mock against a server-authoritative clock, or take an untimed practice run. Answers save automatically.",
  },
  {
    icon: LineChart,
    title: "3. Review every question",
    copy: "After submission you see your scaled score, a per-domain breakdown and a full explanation for each question.",
  },
  {
    icon: Sparkles,
    title: "4. Close the gaps",
    copy: "The Study Assistant turns your weakest domains into a focused plan, and the Interview Coach rehearses the conversation.",
  },
];

function AboutPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-accent-ink">
            How it works
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Practice that behaves like the real exam
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            AskMeExam is an independent practice platform. Every question is original, every score
            is calculated on the server, and every attempt ends with an explanation you can learn
            from.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <ol className="grid gap-6 sm:grid-cols-2">
          {steps.map((step) => (
            <li key={step.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <step.icon className="size-6 text-accent-ink" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{step.copy}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create a free account
          </Link>
          <Link
            to="/certifications" search={{}}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            Browse certifications
          </Link>
        </div>
      </section>
    </main>
  );
}
