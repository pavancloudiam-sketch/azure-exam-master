import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { SurfaceCard } from "@/features/shared/components/ui";
import { useAppSettings } from "@/features/shared/hooks/use-app-settings";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help and support — AskMeExam" },
      { name: "description", content: "Guidance on taking exams, scoring and support contacts." },
      { property: "og:title", content: "Help and support — AskMeExam" },
      { property: "og:description", content: "Guidance on exams, scoring and support." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  {
    q: "What is the difference between timed and practice mode?",
    a: "Timed mode runs a server-authoritative countdown and submits automatically when the time expires. Practice mode uses the same questions with no countdown, so you can work at your own pace.",
  },
  {
    q: "Are my answers saved if I lose connection?",
    a: "Yes. Answers are saved automatically as you go and queued locally while you are offline, then sent as soon as the connection returns. You can resume an unfinished attempt from your dashboard.",
  },
  {
    q: "When can I see the correct answers?",
    a: "Explanations and correct answers stay hidden until you submit. After submission the review screen shows every question with your answer, the correct answer and the explanation.",
  },
  {
    q: "How is my score calculated?",
    a: "Scores are calculated on the server from your saved answers and scaled against the exam's passing score. Per-domain breakdowns show where to focus next.",
  },
  {
    q: "Is AskMeExam affiliated with Microsoft?",
    a: "No. AskMeExam is an independent practice platform. All question content is original and written for practice purposes only.",
  },
];

function HelpPage() {
  const settings = useAppSettings();
  return (
    <PageShell
      title="Help and support"
      description="Answers to the most common questions, plus how to reach a human."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {faqs.map((faq) => (
            <SurfaceCard key={faq.q} title={faq.q}>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </SurfaceCard>
          ))}
        </div>
        <div className="space-y-4">
          <SurfaceCard title="Contact support">
            <p className="text-sm text-muted-foreground">
              Email us and include your attempt link if the question relates to a specific exam.
            </p>
            <a
              href={`mailto:${settings.support_email}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {settings.support_email}
            </a>
          </SurfaceCard>
          <SurfaceCard title="Policies">
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/legal/$docSlug"
                  params={{ docSlug: "terms" }}
                  className="text-accent-ink hover:underline"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/legal/$docSlug"
                  params={{ docSlug: "privacy" }}
                  className="text-accent-ink hover:underline"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/legal/$docSlug"
                  params={{ docSlug: "refunds" }}
                  className="text-accent-ink hover:underline"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </SurfaceCard>
        </div>
      </div>
    </PageShell>
  );
}
