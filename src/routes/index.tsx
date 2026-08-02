import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppSettings } from "../features/shared/hooks/use-app-settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AskMeExam — Microsoft Entra ID Practice Exams" },
      {
        name: "description",
        content:
          "Prepare for Microsoft Entra ID certification with independent practice exams. Practice with Confidence.",
      },
      { property: "og:title", content: "AskMeExam — Microsoft Entra ID Practice Exams" },
      {
        property: "og:description",
        content: "Independent Microsoft Entra ID certification practice exams.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const settings = useAppSettings();
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-accent-ink">
          Microsoft Entra ID practice
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl leading-tight">{settings.tagline}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          AskMeExam is an independent practice platform focused on Microsoft Entra ID
          certification preparation — realistic question formats, timed mocks and untimed
          practice.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
          >
            Go to dashboard
          </Link>
          <Link
            to="/certifications"
            search={{}}
            className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
          
          >
            Browse certifications
          </Link>
        </div>
      </section>
      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
          {[
            { t: "Timed mock exams", d: "Server-authoritative timing and scaled scoring." },
            { t: "Untimed practice", d: "Same engine, no countdown, review after submission." },
            { t: "Domain insights", d: "See performance per certification domain." },
          ].map((f) => (
            <article key={f.t} className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-base font-semibold">{f.t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
