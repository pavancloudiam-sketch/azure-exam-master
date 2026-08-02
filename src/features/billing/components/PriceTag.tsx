import * as React from "react";
import { Tag } from "lucide-react";

import { StatusBadge } from "@/features/shared/components/ui";
import { formatInr } from "../types";
import { formatOfferEnd, offerCountdown, type EffectivePrice } from "../types/pricing";

/**
 * Regular vs promotional price. Whether an offer is live is decided by the
 * server (`pricing.promotion_active`); this component only renders it.
 */
export function PriceTag({
  pricing,
  size = "lg",
}: {
  pricing: EffectivePrice;
  size?: "md" | "lg";
}) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!pricing.promotion_active) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [pricing.promotion_active]);

  const finalClass = size === "lg" ? "text-3xl font-semibold" : "text-xl font-semibold";

  if (!pricing.promotion_active) {
    return (
      <div>
        <p className={finalClass}>{formatInr(pricing.regular_minor)}</p>
        {pricing.upcoming_promotion_starts_at ? (
          <p className="mt-1 text-xs text-muted-foreground">
            A limited-time offer starts {formatOfferEnd(pricing.upcoming_promotion_starts_at, pricing.time_zone)}.
          </p>
        ) : null}
      </div>
    );
  }

  const countdown = offerCountdown(pricing.promotion_ends_at, now);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className={finalClass}>{formatInr(pricing.final_minor)}</span>
        <s className="text-base text-muted-foreground">{formatInr(pricing.regular_minor)}</s>
        <StatusBadge tone="success">
          Save {formatInr(pricing.promotion_discount_minor)}
        </StatusBadge>
      </div>
      <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
        <Tag className="size-4" aria-hidden="true" />
        {pricing.promotion_name ?? "Limited-time offer"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Offer valid until {formatOfferEnd(pricing.promotion_ends_at, pricing.time_zone)} (IST)
        {countdown.expired ? "" : ` · ${countdown.label}`}
      </p>
    </div>
  );
}
