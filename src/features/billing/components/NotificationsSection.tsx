import { useQuery } from "@tanstack/react-query";

import {
  EmptyState,
  ErrorState,
  SkeletonList,
  StatusBadge,
  SurfaceCard,
} from "@/features/shared/components/ui";
import { listMyNotifications } from "../services/billing-service";
import { NOTIFICATION_LABELS, type NotificationRecord } from "../types";

const TONE: Record<NotificationRecord["status"], "success" | "warning" | "neutral" | "error"> = {
  sent: "success",
  queued: "warning",
  failed: "error",
  cancelled: "neutral",
};

/** Read-only view of messages queued for this student. */
export function NotificationsSection() {
  const notifications = useQuery({
    queryKey: ["my-notifications"],
    queryFn: listMyNotifications,
  });

  if (notifications.isLoading) return <SkeletonList rows={2} />;
  if (notifications.error)
    return (
      <ErrorState title="Could not load your messages" onRetry={() => void notifications.refetch()} />
    );

  const rows = notifications.data ?? [];
  if (rows.length === 0)
    return (
      <EmptyState
        title="No messages yet"
        description="Purchase, payment, refund, reminder and result messages will be listed here."
      />
    );

  return (
    <div className="space-y-3">
      {rows.map((n) => (
        <SurfaceCard key={n.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{n.subject}</span>
            <StatusBadge tone={TONE[n.status]}>{n.status}</StatusBadge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {NOTIFICATION_LABELS[n.template] ?? n.template} ·{" "}
            {n.sent_at
              ? `sent ${new Date(n.sent_at).toLocaleString()}`
              : `scheduled ${new Date(n.scheduled_for).toLocaleString()}`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
        </SurfaceCard>
      ))}
    </div>
  );
}