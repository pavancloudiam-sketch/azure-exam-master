import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DestructiveButton,
  EmptyState,
  ErrorState,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SkeletonList,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import {
  listMySubscriptions,
  requestSubscriptionCancellation,
  withdrawSubscriptionCancellation,
} from "../services/billing-service";
import type { SubscriptionRecord } from "../types";

const TONE: Record<SubscriptionRecord["status"], "success" | "warning" | "neutral"> = {
  active: "success",
  past_due: "warning",
  incomplete: "warning",
  cancelled: "neutral",
  expired: "neutral",
};

export function SubscriptionsSection() {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<SubscriptionRecord | null>(null);
  const [reason, setReason] = useState("");

  const subscriptions = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: listMySubscriptions,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-subscriptions"] });
    void queryClient.invalidateQueries({ queryKey: ["my-entitlements"] });
  };

  const cancel = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      requestSubscriptionCancellation(input.id, input.reason),
    onSuccess: () => {
      notify.success("Cancellation requested", "Access continues until the end of the paid period.");
      setCancelling(null);
      setReason("");
      refresh();
    },
    onError: (e: Error) => notify.error("Could not request cancellation", e.message),
  });

  const withdraw = useMutation({
    mutationFn: withdrawSubscriptionCancellation,
    onSuccess: () => {
      notify.success("Cancellation withdrawn", "Your subscription will continue to renew.");
      refresh();
    },
    onError: (e: Error) => notify.error("Could not withdraw cancellation", e.message),
  });

  if (subscriptions.isLoading) return <SkeletonList rows={2} />;
  if (subscriptions.error)
    return (
      <ErrorState
        title="Could not load your subscriptions"
        onRetry={() => void subscriptions.refetch()}
      />
    );

  const rows = subscriptions.data ?? [];
  if (rows.length === 0)
    return (
      <EmptyState
        title="No subscription"
        description="Subscription plans are not on sale yet. Test-mode subscriptions granted by an administrator appear here."
      />
    );

  return (
    <>
      <div className="space-y-3">
        {rows.map((sub) => {
          const live = sub.status === "active" || sub.status === "past_due";
          return (
            <SurfaceCard key={sub.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{sub.products?.name ?? "Subscription"}</span>
                <StatusBadge tone={TONE[sub.status]}>{sub.status.replace("_", " ")}</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {sub.current_period_end
                  ? `${sub.cancel_at_period_end ? "Access ends" : "Renews"} on ${new Date(
                      sub.current_period_end,
                    ).toLocaleDateString()}`
                  : "No billing period recorded"}
                {sub.provider === "test_mode" ? " · test mode" : null}
              </p>
              {sub.cancel_at_period_end && live ? (
                <p className="mt-2 text-sm">
                  Cancellation requested. Your access stays active until the end of the current
                  period, then it is removed automatically.
                </p>
              ) : null}
              {live ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sub.cancel_at_period_end ? (
                    <SecondaryButton
                      size="sm"
                      loading={withdraw.isPending}
                      onClick={() => withdraw.mutate(sub.id)}
                    >
                      Keep my subscription
                    </SecondaryButton>
                  ) : (
                    <DestructiveButton size="sm" onClick={() => setCancelling(sub)}>
                      Request cancellation
                    </DestructiveButton>
                  )}
                </div>
              ) : null}
            </SurfaceCard>
          );
        })}
      </div>

      <Modal
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title="Request cancellation"
        description="Your access continues until the end of the period you have already paid for."
        footer={
          <>
            <SecondaryButton onClick={() => setCancelling(null)}>Keep subscription</SecondaryButton>
            <PrimaryButton
              loading={cancel.isPending}
              loadingText="Sending…"
              onClick={() => {
                if (cancelling) cancel.mutate({ id: cancelling.id, reason });
              }}
            >
              Request cancellation
            </PrimaryButton>
          </>
        }
      >
        <TextField
          id="cancel-reason"
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </>
  );
}