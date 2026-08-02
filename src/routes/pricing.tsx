import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageShell } from "@/features/shared/components/PageShell";
import {
  ErrorState,
  SkeletonList,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
} from "@/features/shared/components/ui";
import { listCatalog } from "@/features/billing/services/catalog-service";
import { formatInr } from "@/features/billing/types";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — AskMeExam Practice Plans" },
      {
        name: "description",
        content:
          "Planned AskMeExam pricing for Microsoft Entra ID practice: one-time exam access and monthly or annual plans in Indian rupees.",
      },
      { property: "og:title", content: "Pricing — AskMeExam Practice Plans" },
      {
        property: "og:description",
        content: "One-time exam access and subscription plans for Microsoft Entra ID practice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function intervalLabel(interval: "month" | "year" | null, count: number) {
  if (!interval) return "one-time";
  if (count === 1) return interval === "month" ? "per month" : "per year";
  return `every ${count} ${interval}s`;
}

function PricingPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["catalog"],
    queryFn: listCatalog,
  });

  return (
    <PageShell
      title="Pricing"
      description="Planned plans for the India launch. Prices are shown in Indian rupees and are indicative until payments are activated."
    >
      <StatusAlert tone="info" title="Payments are not active yet">
        You cannot buy access at the moment. Every practice exam currently available is free to
        start from the exams page. Final pricing, taxes and invoicing depend on the launch
        checklist items still awaiting professional confirmation.
      </StatusAlert>

      <div className="mt-6">
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <ErrorState
            title="Could not load pricing"
            description="Please try again in a moment."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {(data ?? []).map((product) => {
              const price = product.prices[0];
              return (
                <SurfaceCard key={product.id}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">{product.name}</h2>
                    <StatusBadge tone={product.product_type === "subscription" ? "info" : "neutral"}>
                      {product.product_type === "subscription" ? "plan" : "one-time"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>
                  <p className="mt-4 text-2xl font-semibold">
                    {price ? formatInr(price.amount_minor) : "—"}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {price ? intervalLabel(price.billing_interval, price.interval_count) : ""}
                    </span>
                  </p>
                  {product.access_days ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Access for {product.access_days} days.
                    </p>
                  ) : null}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Taxes, if applicable, are not included. GST treatment is pending confirmation.
                  </p>
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Purchases will be governed by the{" "}
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
        , all of which are placeholder drafts today.
      </p>
    </PageShell>
  );
}