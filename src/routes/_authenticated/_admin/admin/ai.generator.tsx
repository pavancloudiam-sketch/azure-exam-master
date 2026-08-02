import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { AiQuestionGeneratorPanel } from "@/features/ai";

export const Route = createFileRoute("/_authenticated/_admin/admin/ai/generator")({
  head: () => ({
    meta: [
      { title: "AI Question Generator | AskMeExam Admin" },
      {
        name: "description",
        content:
          "Draft original Microsoft Entra ID practice questions with AskMe AI, review them, and save them unpublished into the draft question bank.",
      },
      { property: "og:title", content: "AI Question Generator | AskMeExam Admin" },
      {
        property: "og:description",
        content: "Generate, review and save AI-drafted practice questions for human review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageShell
      title="AI Question Generator"
      description="Draft original practice questions for a topic. Nothing is published: saved drafts are inactive and flagged for technical and language review."
    >
      <AiQuestionGeneratorPanel />
    </PageShell>
  ),
});
