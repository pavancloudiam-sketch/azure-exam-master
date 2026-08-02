import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
} from "@/features/shared/components/ui";
import { getUpiCheckout } from "@/features/payments/services/checkout.functions";
import {
  cancelUpiOrder,
  getUpiPaymentStatus,
} from "@/features/payments/services/payment-service";
import { formatInr } from "@/features/billing/types";

export const Route = createFileRoute("/_authenticated/checkout/$orderId")({
  head: () => ({
    meta: [
      { title: "UPI payment — AskMeExam" },
      {
        name: "description",
        content: "Scan the UPI QR code to complete your AskMeExam purchase. Access unlocks after server-side verification.",
      },
      { property: "og:title", content: "UPI payment — AskMeExam" },
      { property: "og:description", content: "Complete your AskMeExam purchase with any UPI app." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const STATUS_LABELS: Record<string, { label: string; tone: "info" | "success" | "error" | "warning" | "neutral" }> = {
  pending_payment: { label: "Waiting for payment", tone: "info" },
  paid: { label: "Payment successful", tone: "success" },
  failed: { label: "Payment failed", tone: "error" },
  expired: { label: "Payment expired", tone: "warning" },
  cancelled: { label: "Payment cancelled", tone: "neutral" },
};

function Countdown({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Clock className="size-4" aria-hidden="true" />
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadCheckout = useServerFn(getUpiCheckout);

  const session = useQuery({
    queryKey: ["upi-checkout", orderId],
    queryFn: () => loadCheckout({ data: { orderId } }),
  });

  const status = useQuery({
    queryKey: ["upi-payment-status", orderId],
    queryFn: () => getUpiPaymentStatus(orderId),
    // The browser polls the server; it never decides the outcome itself.
    refetchInterval: (query) =>
      query.state.data?.order_status === "pending_payment" ? 5000 : false,
  });

  const orderStatus = status.data?.order_status ?? session.data?.status ?? "pending_payment";
  const paid = orderStatus === "paid";

  React.useEffect(() => {
    if (!paid) return;
    void queryClient.invalidateQueries({ queryKey: ["my-purchases"] });
    void queryClient.invalidateQueries({ queryKey: ["my-entitlements"] });
    void queryClient.invalidateQueries({ queryKey: ["exam-access-map"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [paid, queryClient]);

  async function handleCancel() {
    try {
      await cancelUpiOrder(orderId);
      await status.refetch();
      notify.success("Payment cancelled", "No amount has been charged.");
      await navigate({ to: "/billing" });
    } catch (cause) {
      notify.error(cause instanceof Error ? cause.message : "Could not cancel the payment.");
    }
  }

  const badge = STATUS_LABELS[orderStatus] ?? STATUS_LABELS["pending_payment"]!;

  return (
    <PageShell
      title="Complete your payment"
      description="Scan the QR code with any UPI app. Your access unlocks automatically once our server verifies the payment with the provider."
    >
      {session.isLoading ? (
        <LoadingBlock label="Preparing your payment" />
      ) : session.error ? (
        <ErrorState
          title="Payment could not be prepared"
          description={session.error instanceof Error ? session.error.message : "Please try again."}
          onRetry={() => void session.refetch()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <SurfaceCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Order {session.data?.orderNumber}</h2>
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            </div>

            {paid ? (
              <div className="mt-6 text-center">
                <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden="true" />
                <p className="mt-3 text-lg font-semibold">Payment verified</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your purchase is confirmed, the receipt has been issued and your access is active.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {status.data?.exam_id ? (
                    <Link
                      to="/exams/$examId/start"
                      params={{ examId: status.data.exam_id }}
                      search={{ mode: "realistic_mock" as const }}
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Start exam
                    </Link>
                  ) : (
                    <Link
                      to="/exams"
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Go to exams
                    </Link>
                  )}
                  <Link
                    to="/billing"
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                  >
                    View receipt
                  </Link>
                </div>
              </div>
            ) : orderStatus === "failed" || orderStatus === "expired" || orderStatus === "cancelled" ? (
              <div className="mt-6 text-center">
                <XCircle className="mx-auto size-12 text-destructive" aria-hidden="true" />
                <p className="mt-3 text-lg font-semibold">{badge.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No access has been granted and no amount is held. You can start a new payment from
                  the pricing page.
                </p>
                <Link
                  to="/pricing"
                  className="mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Try again
                </Link>
              </div>
            ) : session.data?.configured === false ? (
              <StatusAlert tone="warning" title="UPI payments are not switched on yet" className="mt-4">
                Your order is saved as pending. An administrator still needs to add the Razorpay API
                keys and webhook secret before a QR code can be generated.
              </StatusAlert>
            ) : (
              <div className="mt-6 flex flex-col items-center">
                {session.data?.qrImageUrl ? (
                  <img
                    src={session.data.qrImageUrl}
                    alt={`UPI QR code for order ${session.data.orderNumber}`}
                    width={260}
                    height={260}
                    className="rounded-lg border border-border bg-background p-2"
                  />
                ) : (
                  <LoadingBlock label="Generating QR code" />
                )}
                <p className="mt-3 text-sm text-muted-foreground">
                  Scan and pay with any UPI app — Google Pay, PhonePe, Paytm, BHIM and others.
                </p>
                {session.data?.upiLink ? (
                  <a
                    href={session.data.upiLink}
                    className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Pay in a UPI app
                  </a>
                ) : null}
                <p className="mt-4 text-sm text-muted-foreground">
                  This payment window closes in <Countdown expiresAt={session.data?.expiresAt ?? null} />
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <SecondaryButton onClick={() => void status.refetch()}>
                    <RefreshCw className="mr-2 size-4" aria-hidden="true" /> Refresh status
                  </SecondaryButton>
                  <PrimaryButton onClick={handleCancel} variant="ghost">
                    Cancel payment
                  </PrimaryButton>
                </div>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatInr(session.data?.subtotalMinor ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatInr(session.data?.taxMinor ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatInr(session.data?.totalMinor ?? 0)}</dd>
              </div>
            </dl>
            <p className="mt-4 flex gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              Access is unlocked only after our server verifies a signed payment notification from
              the provider. We never store card or UPI credentials.
            </p>
          </SurfaceCard>
        </div>
      )}
    </PageShell>
  );
}
