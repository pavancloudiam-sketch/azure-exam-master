import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  EmptyState,
  ErrorState,
  SecondaryButton,
  SkeletonList,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
} from "@/features/shared/components/ui";
import { listMyEntitlements, listMyPurchases } from "@/features/billing/services/catalog-service";
import { getInvoice, listMyRefunds } from "@/features/billing/services/billing-service";
import { downloadReceipt } from "@/features/billing/services/receipt";
import { BillingProfileCard } from "@/features/billing/components/BillingProfileCard";
import { SubscriptionsSection } from "@/features/billing/components/SubscriptionsSection";
import { NotificationsSection } from "@/features/billing/components/NotificationsSection";
import { RefundRequestDialog } from "@/features/billing/components/RefundRequestDialog";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { listMyAcceptances } from "@/features/legal/services/legal-service";
import { formatInr } from "@/features/billing/types";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Purchases & access — AskMeExam" },
      {
        name: "description",
        content: "Your AskMeExam purchase history, invoices, refunds and current access rights.",
      },
      { property: "og:title", content: "Purchases & access — AskMeExam" },
      { property: "og:description", content: "Purchase history and access rights." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { user } = useAuth();
  const [refundFor, setRefundFor] = useState<{ id: string; number: string } | null>(null);
  const purchases = useQuery({ queryKey: ["my-purchases"], queryFn: listMyPurchases });
  const entitlements = useQuery({ queryKey: ["my-entitlements"], queryFn: listMyEntitlements });
  const acceptances = useQuery({ queryKey: ["my-legal-acceptances"], queryFn: listMyAcceptances });
  const refunds = useQuery({ queryKey: ["my-refunds"], queryFn: listMyRefunds });

  async function handleDownload(invoiceId: string) {
    try {
      const invoice = await getInvoice(invoiceId);
      if (!invoice) throw new Error("Receipt not found");
      downloadReceipt(invoice, user?.email ?? "");
    } catch (e) {
      notify.error("Could not download the receipt", (e as Error).message);
    }
  }

  return (
    <PageShell
      title="Purchases & access"
      description="Your orders, invoices, refunds, access rights and policy acceptances."
    >
      <StatusAlert tone="info" title="Test mode — payments are not active">
        No real payment can be taken yet. Orders, receipts, refunds and messages shown here are
        test-mode records. Receipts are issued by AskMeExam and have not been reviewed as legally
        compliant tax invoices.
      </StatusAlert>

      <section className="mt-8" aria-labelledby="access-heading">
        <h2 id="access-heading" className="mb-3 text-lg font-semibold">
          Current access
        </h2>
        {entitlements.isLoading ? (
          <SkeletonList rows={2} />
        ) : entitlements.error ? (
          <ErrorState
            title="Could not load your access"
            onRetry={() => void entitlements.refetch()}
          />
        ) : (entitlements.data ?? []).length === 0 ? (
          <EmptyState
            title="No purchased access"
            description="Practice exams that are currently free remain available from the exams page."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(entitlements.data ?? []).map((e) => (
              <SurfaceCard key={e.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.products?.name ?? "Granted access"}</span>
                  <StatusBadge tone="success">{e.access_scope}</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Source: {e.source.replace("_", " ")} ·{" "}
                  {e.expires_at
                    ? `expires ${new Date(e.expires_at).toLocaleDateString()}`
                    : "no expiry"}
                </p>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="mb-3 text-lg font-semibold">
          Purchase history
        </h2>
        {purchases.isLoading ? (
          <SkeletonList rows={3} />
        ) : purchases.error ? (
          <ErrorState title="Could not load your orders" onRetry={() => void purchases.refetch()} />
        ) : (purchases.data ?? []).length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Orders, invoices and refunds will be listed here once payments are activated."
          />
        ) : (
          <div className="space-y-3">
            {(purchases.data ?? []).map((order) => (
              <SurfaceCard key={order.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{order.order_number}</span>
                  <StatusBadge tone={order.status === "paid" ? "success" : "neutral"}>
                    {order.status.replace("_", " ")}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(order.placed_at ?? order.created_at).toLocaleString()} ·{" "}
                  {formatInr(order.total_minor)}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {order.order_items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4">
                      <span>
                        {item.product_name} × {item.quantity}
                      </span>
                      <span>{formatInr(item.total_minor)}</span>
                    </li>
                  ))}
                </ul>
                {order.invoices.length > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Receipt {order.invoices[0]!.invoice_number} ({order.invoices[0]!.status})
                  </p>
                ) : null}
                {order.refunds.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Refund {formatInr(order.refunds[0]!.amount_minor)} — {order.refunds[0]!.status}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.invoices.length > 0 ? (
                    <SecondaryButton
                      size="sm"
                      onClick={() => void handleDownload(order.invoices[0]!.id)}
                    >
                      Download receipt
                    </SecondaryButton>
                  ) : null}
                  {order.status === "paid" && order.refunds.length === 0 ? (
                    <SecondaryButton
                      size="sm"
                      onClick={() =>
                        setRefundFor({ id: order.id, number: order.order_number })
                      }
                    >
                      Request a refund
                    </SecondaryButton>
                  ) : null}
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="subscriptions-heading">
        <h2 id="subscriptions-heading" className="mb-3 text-lg font-semibold">
          Subscription
        </h2>
        <SubscriptionsSection />
      </section>

      <section className="mt-10" aria-labelledby="refunds-heading">
        <h2 id="refunds-heading" className="mb-3 text-lg font-semibold">
          Refund requests
        </h2>
        {refunds.isLoading ? (
          <SkeletonList rows={2} />
        ) : refunds.error ? (
          <ErrorState title="Could not load your refunds" onRetry={() => void refunds.refetch()} />
        ) : (refunds.data ?? []).length === 0 ? (
          <EmptyState
            title="No refund requests"
            description="You can request a refund from a paid order above."
          />
        ) : (
          <div className="space-y-3">
            {(refunds.data ?? []).map((r) => (
              <SurfaceCard key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.orders?.order_number ?? "Order"} · {formatInr(r.amount_minor)}
                  </span>
                  <StatusBadge
                    tone={
                      r.status === "processed" || r.status === "approved"
                        ? "success"
                        : r.status === "rejected" || r.status === "failed"
                          ? "error"
                          : "warning"
                    }
                  >
                    {r.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested {new Date(r.created_at).toLocaleString()}
                  {r.decided_at ? ` · decided ${new Date(r.decided_at).toLocaleString()}` : ""}
                </p>
                <p className="mt-2 text-sm">Your reason: {r.reason}</p>
                {r.decision_note ? (
                  <p className="mt-1 text-sm text-muted-foreground">Reviewer note: {r.decision_note}</p>
                ) : null}
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="billing-details-heading">
        <h2 id="billing-details-heading" className="mb-3 text-lg font-semibold">
          Billing details
        </h2>
        <BillingProfileCard />
      </section>

      <section className="mt-10" aria-labelledby="messages-heading">
        <h2 id="messages-heading" className="mb-3 text-lg font-semibold">
          Messages
        </h2>
        <NotificationsSection />
      </section>

      {refundFor ? (
        <RefundRequestDialog
          orderId={refundFor.id}
          orderNumber={refundFor.number}
          open
          onOpenChange={(open) => {
            if (!open) setRefundFor(null);
          }}
        />
      ) : null}

      <section className="mt-10" aria-labelledby="policies-heading">
        <h2 id="policies-heading" className="mb-3 text-lg font-semibold">
          Policy acceptances
        </h2>
        {acceptances.isLoading ? (
          <SkeletonList rows={2} />
        ) : (acceptances.data ?? []).length === 0 ? (
          <EmptyState
            title="No recorded acceptance"
            description="Acceptance is recorded when you create an account or accept an updated policy."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {(acceptances.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-4 py-3">
                <span>
                  {a.doc_type.replace(/_/g, " ")} · version {a.version}
                </span>
                <span className="text-muted-foreground">
                  {new Date(a.accepted_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Read the current{" "}
          <Link to="/legal/$docSlug" params={{ docSlug: "terms" }} className="underline">
            Terms
          </Link>
          ,{" "}
          <Link to="/legal/$docSlug" params={{ docSlug: "privacy" }} className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/legal/$docSlug" params={{ docSlug: "refunds" }} className="underline">
            Refund Policy
          </Link>
          .
        </p>
      </section>
    </PageShell>
  );
}