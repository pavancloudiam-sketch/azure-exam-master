import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeIndianRupee, Percent, Tag, Users } from "lucide-react";

import {
  ConfirmDialog,
  DataTable,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  SkeletonList,
  StatCard,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
  type BadgeTone,
  type Column,
} from "@/features/shared/components/ui";
import { formatInr } from "../types";
import {
  createPromotion,
  getPricingSalesSummary,
  getPromotionReport,
  getPublicPricing,
  listActorLabels,
  listPromotions,
  listProductsWithPrices,
  updatePromotion,
  type PromotionInput,
} from "../services/pricing-service";
import {
  formatOfferEnd,
  offerCountdown,
  promotionStatus,
  type PromotionRecord,
  type PromotionReportRow,
  type PromotionStatus,
} from "../types/pricing";
import { PriceTag } from "./PriceTag";
import { PromotionFormModal, type ProductOption } from "./PromotionFormModal";

const statusTone: Record<PromotionStatus, BadgeTone> = {
  Active: "success",
  Scheduled: "info",
  Draft: "neutral",
  Expired: "neutral",
  Disabled: "warning",
};

type Row = {
  record: PromotionRecord;
  report: PromotionReportRow | undefined;
  status: PromotionStatus;
};

/**
 * Administrator view over promotional pricing. Every amount and every
 * "is this live?" answer comes from the database — this screen only edits the
 * rules and reports what the server already decided.
 */
export function PromotionsPanel() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PromotionRecord | null>(null);
  const [toggling, setToggling] = React.useState<PromotionRecord | null>(null);

  const promotions = useQuery({ queryKey: ["admin-promotions"], queryFn: listPromotions });
  const report = useQuery({ queryKey: ["admin-promotion-report"], queryFn: getPromotionReport });
  const summary = useQuery({ queryKey: ["admin-pricing-summary"], queryFn: getPricingSalesSummary });
  const products = useQuery({ queryKey: ["admin-product-prices"], queryFn: listProductsWithPrices });
  const publicPricing = useQuery({ queryKey: ["public-pricing"], queryFn: getPublicPricing });

  const actorIds = (promotions.data ?? [])
    .flatMap((p) => [p.created_by, p.updated_by])
    .filter((id): id is string => Boolean(id));
  const actors = useQuery({
    queryKey: ["admin-promotion-actors", actorIds.slice().sort().join(",")],
    queryFn: () => listActorLabels(actorIds),
    enabled: actorIds.length > 0,
  });

  // The database is the clock. We anchor to the timestamp it reported and let
  // local time advance from there, so a wrong browser clock cannot change status.
  const serverNowRef = React.useRef<{ server: number; local: number } | null>(null);
  const serverStamp = publicPricing.data?.[0]?.pricing.server_now;
  if (serverStamp && !serverNowRef.current) {
    serverNowRef.current = { server: new Date(serverStamp).getTime(), local: Date.now() };
  }
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const anchor = serverNowRef.current;
  const serverNow = React.useMemo(
    () => (anchor ? new Date(anchor.server + (Date.now() - anchor.local)) : new Date()),
    [anchor, tick],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-promotion-report"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-pricing-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["public-pricing"] });
  };

  const save = useMutation({
    mutationFn: async (input: PromotionInput) =>
      editing ? updatePromotion(editing.id, input) : createPromotion(input),
    onSuccess: () => {
      notify.success(
        editing ? "Promotion updated" : "Promotion created",
        "Student pricing follows the server clock automatically.",
      );
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (e: Error) =>
      notify.error(
        "Could not save the promotion",
        e.message.includes("exclusion") || e.message.includes("overlap")
          ? "Another enabled offer already covers part of this date range for the same product."
          : e.message,
      ),
  });

  const toggle = useMutation({
    mutationFn: async (promo: PromotionRecord) =>
      updatePromotion(promo.id, { is_active: !promo.is_active }),
    onSuccess: () => {
      notify.success("Promotion updated");
      setToggling(null);
      refresh();
    },
    onError: (e: Error) => notify.error("Could not update the promotion", e.message),
  });

  const productOptions: ProductOption[] = (products.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    regular_minor: p.prices.find((price) => price.is_active)?.amount_minor ?? 0,
  }));

  const rows: Row[] = (promotions.data ?? []).map((record) => ({
    record,
    report: (report.data ?? []).find((r) => r.promotion_id === record.id),
    status: promotionStatus(record, serverNow),
  }));

  const regularFor = (productId: string) =>
    productOptions.find((p) => p.id === productId)?.regular_minor ?? 0;

  const columns: Column<Row>[] = [
    {
      key: "offer",
      header: "Offer",
      render: ({ record, report: r }) => (
        <div>
          <p className="font-medium">{record.name}</p>
          <p className="text-xs text-muted-foreground">
            {r?.product_name ?? record.products?.name ?? "Product"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: ({ record, status }) => (
        <div className="space-y-1">
          <StatusBadge tone={statusTone[status]}>{status}</StatusBadge>
          {status === "Active" ? (
            <p className="text-xs text-muted-foreground">
              {offerCountdown(record.ends_at, serverNow).label}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: ({ record }) => {
        const regular = regularFor(record.product_id);
        const savings = regular > record.promo_amount_minor ? regular - record.promo_amount_minor : 0;
        return (
          <div>
            <span className="font-medium">{formatInr(record.promo_amount_minor)}</span>{" "}
            {regular ? <s className="text-muted-foreground">{formatInr(regular)}</s> : null}
            {savings ? (
              <p className="text-xs text-success-ink">
                Saves {formatInr(savings)} ({Math.round((savings / regular) * 100)}%)
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "window",
      header: "Window (IST)",
      render: ({ record }) => (
        <div className="text-xs text-muted-foreground">
          <p>{formatOfferEnd(record.starts_at, record.time_zone)}</p>
          <p>to {formatOfferEnd(record.ends_at, record.time_zone)}</p>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Usage",
      render: ({ report: r }) => (
        <div className="text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">{r?.paid_orders ?? 0} paid</p>
          <p>
            {r?.students ?? 0} students · {r?.pending_orders ?? 0} pending
          </p>
          <p>Collected {formatInr(r?.collected_minor ?? 0)}</p>
        </div>
      ),
    },
    {
      key: "changed",
      header: "Last changed",
      render: ({ record }) => (
        <div className="text-xs text-muted-foreground">
          <p>{new Date(record.updated_at).toLocaleDateString()}</p>
          <p>
            {record.updated_by
              ? (actors.data?.[record.updated_by] ?? "Administrator")
              : "System seed"}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: ({ record }) => (
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            size="sm"
            onClick={() => {
              setEditing(record);
              setFormOpen(true);
            }}
          >
            Edit
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={() => setToggling(record)}>
            {record.is_active ? "Disable" : "Enable"}
          </SecondaryButton>
        </div>
      ),
    },
  ];

  const s = summary.data;

  return (
    <div className="space-y-6">
      <StatusAlert tone="info" title="The server owns the offer">
        Promotional prices are calculated in the database from its own clock. A promotion stops
        applying the moment it expires, even for a checkout page left open — and coupons never stack
        with an offer unless you allow it; students simply get whichever price is lower.
      </StatusAlert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Promotional orders"
          value={s?.promotional_orders ?? 0}
          hint={`${s?.regular_orders ?? 0} at regular price`}
          icon={Tag}
        />
        <StatCard
          label="Discount given"
          value={formatInr(s?.promotional_discount_minor ?? 0)}
          hint={`Coupons ${formatInr(s?.coupon_discount_minor ?? 0)}`}
          icon={Percent}
        />
        <StatCard
          label="Collected"
          value={formatInr(s?.collected_minor ?? 0)}
          hint={`Gross ${formatInr(s?.gross_minor ?? 0)}`}
          icon={BadgeIndianRupee}
        />
        <StatCard
          label="Pending / expired"
          value={`${s?.pending_promotional_orders ?? 0} / ${s?.expired_promotional_orders ?? 0}`}
          hint="Promotional checkouts not yet paid"
          icon={Users}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Promotions</h3>
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          New promotion
        </PrimaryButton>
      </div>

      {promotions.isLoading ? (
        <SkeletonList rows={3} />
      ) : promotions.error ? (
        <ErrorState
          title="Could not load promotions"
          onRetry={() => void promotions.refetch()}
        />
      ) : (
        <DataTable
          caption="Promotional pricing"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.record.id}
          emptyMessage="No promotions yet. Create one to run a limited-time offer."
        />
      )}

      <section aria-labelledby="promo-preview-heading">
        <h3 id="promo-preview-heading" className="mb-3 text-lg font-semibold">
          What students see right now
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(publicPricing.data ?? []).map((row) => (
            <SurfaceCard key={row.product_id}>
              <p className="text-sm font-medium text-muted-foreground">{row.name}</p>
              <div className="mt-3">
                <PriceTag pricing={row.pricing} size="md" />
              </div>
            </SurfaceCard>
          ))}
        </div>
      </section>

      <PromotionFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        products={productOptions}
        promotion={editing}
        saving={save.isPending}
        onSubmit={(input) => save.mutate(input)}
      />

      <ConfirmDialog
        open={Boolean(toggling)}
        onOpenChange={(open) => {
          if (!open) setToggling(null);
        }}

        title={toggling?.is_active ? "Disable this promotion?" : "Enable this promotion?"}
        description={
          toggling?.is_active
            ? "Students will immediately go back to the regular price. Orders already paid are unaffected."
            : "Inside its date window, students will immediately see the promotional price."
        }
        confirmLabel={toggling?.is_active ? "Disable offer" : "Enable offer"}
        onConfirm={() => {
          if (toggling) toggle.mutate(toggling);
        }}
      />

    </div>
  );
}
