import { useQuery } from "@tanstack/react-query";

import { ErrorState, SkeletonList, StatusBadge, SurfaceCard } from "@/features/shared/components/ui";

import { getQueueHealth } from "../services/queue-service";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "error" | "warning" }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {value}
        {tone && value > 0 ? (
          <StatusBadge tone={tone} className="ml-2 align-middle">
            attention
          </StatusBadge>
        ) : null}
      </p>
    </div>
  );
}

/** Read-only queue monitoring for administrators. */
export function QueueHealthPanel() {
  const health = useQuery({
    queryKey: ["queue-health"],
    queryFn: getQueueHealth,
    refetchInterval: 30_000,
  });

  if (health.isLoading) return <SkeletonList rows={2} />;
  if (health.error)
    return <ErrorState title="Could not load queue health" onRetry={() => void health.refetch()} />;

  const emails = health.data?.emails;
  const webhooks = health.data?.webhooks;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SurfaceCard>
        <h3 className="font-medium">Email queue</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Waiting" value={emails?.queued ?? 0} />
          <Stat label="Due now" value={emails?.due ?? 0} />
          <Stat label="Retrying" value={emails?.retrying ?? 0} tone="warning" />
          <Stat label="Dead letter" value={emails?.dead_letter ?? 0} tone="error" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {emails?.oldest_due
            ? `Oldest due job scheduled ${new Date(emails.oldest_due).toLocaleString()}`
            : "No jobs are waiting."}
        </p>
      </SurfaceCard>

      <SurfaceCard>
        <h3 className="font-medium">Webhook queue</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pending" value={webhooks?.pending ?? 0} />
          <Stat label="Due now" value={webhooks?.due ?? 0} />
          <Stat label="Retrying" value={webhooks?.retrying ?? 0} tone="warning" />
          <Stat label="Dead letter" value={webhooks?.dead_letter ?? 0} tone="error" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {webhooks?.oldest_due
            ? `Oldest due delivery scheduled ${new Date(webhooks.oldest_due).toLocaleString()}`
            : "No deliveries are waiting."}
        </p>
      </SurfaceCard>
    </div>
  );
}
