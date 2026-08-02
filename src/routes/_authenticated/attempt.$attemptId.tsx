import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ExamRunner } from "@/features/attempts/components/ExamRunner";
import { getAttemptExamTitle } from "@/features/attempts/services/attempt-service";
import { LoadingBlock } from "@/features/shared/components/ui";

export const Route = createFileRoute("/_authenticated/attempt/$attemptId")({
  head: () => ({
    meta: [
      { title: "Exam session — AskMeExam" },
      { name: "description", content: "Your active AskMeExam practice exam session." },
      { property: "og:title", content: "Exam session — AskMeExam" },
      { property: "og:description", content: "Your active practice exam session." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttemptPage,
});

function AttemptPage() {
  const { attemptId } = Route.useParams();
  // One embedded read replaces the previous attempt-then-exam request pair.
  const { data: title, isPending } = useQuery({
    queryKey: ["attempt-exam-title", attemptId],
    queryFn: () => getAttemptExamTitle(attemptId),
    staleTime: Infinity,
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      {isPending ? (
        <LoadingBlock label="Loading your exam" />
      ) : (
        <ExamRunner attemptId={attemptId} examTitle={title ?? "Practice exam"} />
      )}
    </main>
  );
}