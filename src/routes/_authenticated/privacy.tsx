import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/features/shared/components/PageShell";
import { DataRightsPanel } from "@/features/privacy/components/DataRightsPanel";

function PrivacyPage() {
  return (
    <PageShell
      title="Privacy and your data"
      description="Download a copy of everything AskMeExam holds about you, review the consents you have given, and ask us to delete your account."
    >
      <DataRightsPanel />
    </PageShell>
  );
}

export const Route = createFileRoute("/_authenticated/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy and your data — AskMeExam" },
      {
        name: "description",
        content:
          "Export your AskMeExam data, review recorded consents and request account deletion.",
      },
      { property: "og:title", content: "Privacy and your data — AskMeExam" },
      {
        property: "og:description",
        content:
          "Export your AskMeExam data, review recorded consents and request account deletion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});