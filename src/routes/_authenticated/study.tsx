import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { AiStudyAssistantPanel } from "@/features/ai/components/AiStudyAssistantPanel";

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({
    meta: [
      { title: "AI Study Assistant — AskMeExam" },
      {
        name: "description",
        content:
          "Get personalised Microsoft Entra ID study guidance: explanations for your incorrect answers, weak-domain analysis and a study plan built from your own results.",
      },
      { property: "og:title", content: "AI Study Assistant — AskMeExam" },
      {
        property: "og:description",
        content: "Personalised Entra ID study plans, weak-domain analysis and mistake explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudyPage,
});

function StudyPage() {
  return (
    <PageShell
      title="AskMe AI Study Assistant"
      description="Personalised study guidance built from your submitted practice attempts. AskMe AI answers study questions about Microsoft Entra ID only, and never reveals live exam content."
    >
      <AiStudyAssistantPanel />
    </PageShell>
  );
}
