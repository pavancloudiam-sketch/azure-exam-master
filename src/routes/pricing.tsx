import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import { ErrorState, SkeletonList, StatusBadge, SurfaceCard } from "@/features/shared/components/ui";
import { getPublicPricing } from "@/features/billing/services/pricing-service";
import { PriceTag } from "@/features/billing/components/PriceTag";
import { BuyNowButton } from "@/features/payments/components/BuyNowButton";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Microsoft Entra ID Practice Exam Offer" },
      {
        name: "description",
        content:
          "Launch offer: the AskMeExam Microsoft Entra ID realistic practice exam for ₹300 instead of ₹500, until 2 September 2026. Pay securely by UPI.",
      },
      { property: "og:title", content: "Pricing — Microsoft Entra ID Practice Exam Offer" },
      {
        property: "og:description",
        content: "Limited-time launch price on the realistic Microsoft Entra ID practice exam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function intervalLabel(interval: string | null, count: number) {
  if (!interval) return "one-time payment";
  if (count === 1) return interval === "month" ? "per month" : "per year";
  return `every ${count} ${interval}s`;
}

function PricingPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: getPublicPricing,
  });

  return (
    <PageShell
      title="Pricing"
      description="Prices are shown in Indian rupees and are calculated by our servers, including any live offer."
    >
      <div className="mt-2">
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <ErrorState
            title="Could not load pricing"
            description="Please try again in a moment."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data ?? []).map((product) => (
              <SurfaceCard key={product.product_id}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">{product.name}</h2>
                  <StatusBadge tone={product.product_type === "subscription" ? "info" : "neutral"}>
                    {product.product_type === "subscription" ? "plan" : "one-time"}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>
                <div className="mt-4">
                  <PriceTag pricing={product.pricing} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {intervalLabel(product.billing_interval, product.interval_count)}
                    {product.access_days ? ` · access for ${product.access_days} days` : ""}
                  </p>
                </div>
                <div className="mt-5">
                  <BuyNowButton productId={product.product_id} className="w-full" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Pay by UPI. Access unlocks automatically once the payment is verified.
                </p>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Purchases are governed by the{" "}
        <Link to="/legal/$docSlug" params={{ docSlug: "terms" }} className="underline">
          Terms of Service
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
    </PageShell>
  );
}
