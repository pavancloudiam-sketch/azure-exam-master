import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PrimaryButton, notify } from "@/features/shared/components/ui";
import { startUpiCheckout } from "../services/checkout.functions";

/**
 * Starts a UPI checkout for a product and sends the student to the payment
 * screen. Creating the order grants nothing on its own.
 */
export function BuyNowButton({
  productId,
  label = "Buy now with UPI",
  className,
}: {
  productId: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const start = useServerFn(startUpiCheckout);
  const [busy, setBusy] = React.useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const session = await start({ data: { productId } });
      await navigate({ to: "/checkout/$orderId", params: { orderId: session.orderId } });
    } catch (cause) {
      notify.error(
        "Could not start the payment",
        cause instanceof Error ? cause.message : "Please try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PrimaryButton onClick={handleClick} disabled={busy} className={className}>
      {busy ? "Preparing payment…" : label}
    </PrimaryButton>
  );
}
