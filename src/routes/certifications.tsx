import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../features/shared/components/PageShell";

export const Route = createFileRoute("/certifications")({
  head: () => ({
    meta: [
      { title: "Certifications — AskMeExam" },
      {
        name: "description",
        content: "Microsoft Entra ID certification practice tracks available on AskMeExam.",
      },
      { property: "og:title", content: "Certifications — AskMeExam" },
      {
        property: "og:description",
        content: "Microsoft Entra ID certification practice tracks.",
      },
    ],
  }),
  component: () => (
    <PageShell
      title="Certifications"
      description="Phase 1 covers Microsoft Entra ID certification practice only."
    >
      <p className="text-sm text-muted-foreground">Coming in a later step.</p>
    </PageShell>
  ),
});