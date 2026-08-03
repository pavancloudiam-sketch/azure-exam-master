import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  SkeletonList,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import {
  createTestOrder,
  decideRefund,
  findStudentByEmail,
  listAdminProducts,
  listAllNotifications,
  listRefundsForReview,
  markNotificationSent,
  markRefundProcessed,
} from "@/features/billing/services/admin-billing-service";
import { NOTIFICATION_LABELS, formatInr } from "@/features/billing/types";
import { PromotionsPanel } from "@/features/billing/components/PromotionsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueueHealthPanel } from "@/features/queue/components/QueueHealthPanel";
import { requeueEmailJob } from "@/features/queue/services/queue-service";


export const Route = createFileRoute("/_authenticated/_admin/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing operations — AskMeExam admin" },
      {
        name: "description",
        content: "Review refund requests, message delivery and test-mode orders.",
      },
      { property: "og:title", content: "Billing operations — AskMeExam admin" },
      { property: "og:description", content: "Refund review and notification queue." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBillingPage,
});

function AdminBillingPage() {
  const queryClient = useQueryClient();
  const [refundFilter, setRefundFilter] = useState("requested");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [outcome, setOutcome] = useState<"paid" | "failed">("paid");

  const refunds = useQuery({
    queryKey: ["admin-refunds", refundFilter],
    queryFn: () => listRefundsForReview(refundFilter),
  });
  const notifications = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => listAllNotifications(),
  });
  const products = useQuery({ queryKey: ["admin-products"], queryFn: listAdminProducts });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
  };

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "rejected" }) =>
      decideRefund(input.id, input.decision, notes[input.id] ?? ""),
    onSuccess: () => {
      notify.success("Refund decision recorded");
      refreshAll();
    },
    onError: (e: Error) => notify.error("Could not record the decision", e.message),
  });

  const process = useMutation({
    mutationFn: (id: string) => markRefundProcessed(id, notes[id] ?? ""),
    onSuccess: () => {
      notify.success("Refund marked as processed", "Access from that order was removed.");
      refreshAll();
    },
    onError: (e: Error) => notify.error("Could not mark the refund processed", e.message),
  });

  const send = useMutation({
    mutationFn: (id: string) => markNotificationSent(id),
    onSuccess: () => {
      notify.success("Delivery recorded", "Retrying an already-sent message never resends it.");
      void queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
    onError: (e: Error) => notify.error("Could not record delivery", e.message),
  });

  const requeue = useMutation({
    mutationFn: (id: string) => requeueEmailJob(id),
    onSuccess: () => {
      notify.success("Message requeued", "The worker will pick it up on the next run.");
      void queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-health"] });
    },
    onError: (e: Error) => notify.error("Could not requeue the message", e.message),
  });

  const testOrder = useMutation({
    mutationFn: async () => {
      const student = await findStudentByEmail(email);
      if (!student) throw new Error("No student found with that email address");
      if (!productId) throw new Error("Choose a product");
      await createTestOrder(student.id, productId, outcome);
    },
    onSuccess: () => {
      notify.success("Test order created", "No money was collected.");
      refreshAll();
    },
    onError: (e: Error) => notify.error("Could not create the test order", e.message),
  });

  return (
    <PageShell
      title="Billing operations"
      description="Promotional pricing, refund review, message delivery and test-mode order simulation."
    >
      <Tabs defaultValue="promotions">
        <TabsList>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="mt-6">
          <PromotionsPanel />
        </TabsContent>

        <TabsContent value="operations" className="mt-6">
      <StatusAlert tone="warning" title="Test mode">
        No payment provider is connected. Test orders move no money, and message delivery is
        recorded rather than emailed. Every action here is written to the financial audit log.
      </StatusAlert>

      <section className="mt-8" aria-labelledby="refunds-heading">

        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="refunds-heading" className="text-lg font-semibold">
            Refund requests
          </h2>
          <div className="w-48">
            <SelectField
              id="refund-filter"
              label="Status"
              value={refundFilter}
              onValueChange={setRefundFilter}
              options={[
                { value: "requested", label: "Requested" },
                { value: "approved", label: "Approved" },
                { value: "processed", label: "Processed" },
                { value: "rejected", label: "Rejected" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
        </div>
        {refunds.isLoading ? (
          <SkeletonList rows={3} />
        ) : refunds.error ? (
          <ErrorState title="Could not load refunds" onRetry={() => void refunds.refetch()} />
        ) : (refunds.data ?? []).length === 0 ? (
          <EmptyState title="Nothing to review" description="No refunds match this status." />
        ) : (
          <div className="space-y-3">
            {(refunds.data ?? []).map((r) => (
              <SurfaceCard key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.orders?.order_number ?? "Order"} · {formatInr(r.amount_minor)}
                  </span>
                  <StatusBadge tone={r.status === "requested" ? "warning" : "neutral"}>
                    {r.status}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm">Student reason: {r.reason}</p>
                {r.decision_note ? (
                  <p className="mt-1 text-sm text-muted-foreground">Note: {r.decision_note}</p>
                ) : null}
                {r.status === "requested" || r.status === "approved" ? (
                  <div className="mt-4 space-y-3">
                    <TextField
                      id={`note-${r.id}`}
                      label={r.status === "approved" ? "Provider reference" : "Decision note"}
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      {r.status === "requested" ? (
                        <>
                          <PrimaryButton
                            size="sm"
                            loading={decide.isPending}
                            onClick={() => decide.mutate({ id: r.id, decision: "approved" })}
                          >
                            Approve
                          </PrimaryButton>
                          <SecondaryButton
                            size="sm"
                            loading={decide.isPending}
                            onClick={() => decide.mutate({ id: r.id, decision: "rejected" })}
                          >
                            Reject
                          </SecondaryButton>
                        </>
                      ) : (
                        <PrimaryButton
                          size="sm"
                          loading={process.isPending}
                          onClick={() => process.mutate(r.id)}
                        >
                          Mark as processed
                        </PrimaryButton>
                      )}
                    </div>
                  </div>
                ) : null}
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-3 text-lg font-semibold">
          Message queue
        </h2>
        <div className="mb-4">
          <QueueHealthPanel />
        </div>
        {notifications.isLoading ? (
          <SkeletonList rows={3} />
        ) : notifications.error ? (
          <ErrorState
            title="Could not load the queue"
            onRetry={() => void notifications.refetch()}
          />
        ) : (notifications.data ?? []).length === 0 ? (
          <EmptyState title="Queue is empty" description="Messages appear here as events happen." />
        ) : (
          <div className="space-y-3">
            {(notifications.data ?? []).map((n) => (
              <SurfaceCard key={n.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{n.subject}</span>
                  <StatusBadge
                    tone={
                      n.status === "sent" ? "success" : n.status === "failed" ? "error" : "warning"
                    }
                  >
                    {n.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {NOTIFICATION_LABELS[n.template] ?? n.template} · {n.to_email} · attempts{" "}
                  {n.attempts} ·{" "}
                  {n.sent_at
                    ? `sent ${new Date(n.sent_at).toLocaleString()}`
                    : `scheduled ${new Date(n.scheduled_for).toLocaleString()}`}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
                {n.status !== "sent" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SecondaryButton
                      size="sm"
                      loading={send.isPending}
                      onClick={() => send.mutate(n.id)}
                    >
                      Record delivery
                    </SecondaryButton>
                    {n.status === "dead_letter" ? (
                      <SecondaryButton
                        size="sm"
                        loading={requeue.isPending}
                        onClick={() => requeue.mutate(n.id)}
                      >
                        Requeue
                      </SecondaryButton>
                    ) : null}
                  </div>
                ) : null}
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="test-order-heading">
        <h2 id="test-order-heading" className="mb-3 text-lg font-semibold">
          Create a test-mode order
        </h2>
        <SurfaceCard>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="student-email"
              label="Student email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <SelectField
              id="test-product"
              label="Product"
              value={productId}
              onValueChange={setProductId}
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <SelectField
              id="test-outcome"
              label="Simulated outcome"
              value={outcome}
              onValueChange={(v) => setOutcome(v as "paid" | "failed")}
              options={[
                { value: "paid", label: "Payment succeeds" },
                { value: "failed", label: "Payment fails" },
              ]}
            />
          </div>
          <div className="mt-4">
            <PrimaryButton
              loading={testOrder.isPending}
              loadingText="Creating…"
              onClick={() => testOrder.mutate()}
            >
              Create test order
            </PrimaryButton>
          </div>
        </SurfaceCard>
      </section>
        </TabsContent>
      </Tabs>
    </PageShell>

  );
}