import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { AiInterviewPanel } from "@/features/ai/components/AiInterviewPanel";

export const Route = createFileRoute("/_authenticated/interview")({
  head: () => ({
    meta: [
      { title: "AI Interview Coach — AskMeExam" },
      {
        name: "description",
        content:
          "Practise Microsoft Entra ID interview questions with AskMe AI and get constructive feedback on every answer.",
      },
      { property: "og:title", content: "AI Interview Coach — AskMeExam" },
      {
        property: "og:description",
        content: "Mock Entra ID interviews with feedback, missing concepts and model answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InterviewPage,
});

function InterviewPage() {
  return (
    <PageShell
      title="AskMe AI Interview Coach"
      description="Choose a topic, difficulty, length and question style, then answer as you would in a real interview. Feedback is practice only and never represents an employer's hiring decision."
    >
      <AiInterviewPanel />
    </PageShell>
  );
}
