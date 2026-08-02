import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  StatusBadge,
} from "@/features/shared/components/ui";
import { listMyAttempts } from "@/features/attempts/services/attempt-service";
import { formatDuration } from "../types";

/** Recent attempts. Cancelled and in-progress attempts are never shown as results. */
export function AttemptHistory() {
  // React Query de-duplicates the request (one fetch per mount, cached across
  // navigations) where the previous effect fired twice on every mount.
  const { data: attempts, error } = useQuery({
    queryKey: ["my-attempts"],
    queryFn: () => listMyAttempts(),
    staleTime: 30_000,
  });

  if (error)
    return (
      <ErrorState
        title="Attempts unavailable"
        description={error instanceof Error ? error.message : "Could not load your attempts."}
      />
    );
  if (!attempts) return <LoadingBlock label="Loading your attempts" />;
  if (attempts.length === 0) {
    return (
      <EmptyState
        title="No attempts yet"
        description="Start a practice exam and your results will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Your recent exam attempts</caption>
        <thead className="bg-surface">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">Date</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Mode</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Scaled score</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Time taken</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => {
            const submitted = attempt.status === "submitted";
            return (
              <tr key={attempt.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {new Date(attempt.started_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">{attempt.mode === "timed" ? "Timed" : "Practice"}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    tone={
                      submitted ? "success" : attempt.status === "cancelled" ? "neutral" : "info"
                    }
                  >
                    {submitted
                      ? "Completed"
                      : attempt.status === "cancelled"
                        ? "Cancelled"
                        : "In progress"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {submitted ? `${attempt.scaled_score ?? 0} / 1000` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {submitted && attempt.duration_seconds !== null
                    ? formatDuration(attempt.duration_seconds)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {submitted ? (
                    <Link
                      to="/results/$attemptId"
                      params={{ attemptId: attempt.id }}
                      className="rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View result
                    </Link>
                  ) : attempt.status === "in_progress" ? (
                    <Link
                      to="/attempt/$attemptId"
                      params={{ attemptId: attempt.id }}
                      className="rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Resume
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}