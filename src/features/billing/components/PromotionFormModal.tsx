import * as React from "react";

import {
  CheckboxField,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  StatusAlert,
  TextField,
} from "@/features/shared/components/ui";
import { formatInr } from "../types";
import {
  istToIso,
  isoToIstParts,
  promotionFieldErrors,
  type PromotionFormValues,
} from "../validation/promotion-schemas";
import type { PromotionInput } from "../services/pricing-service";
import type { PromotionRecord } from "../types/pricing";

export type ProductOption = { id: string; name: string; regular_minor: number };

function emptyValues(products: ProductOption[]): PromotionFormValues {
  const first = products[0];
  const now = isoToIstParts(new Date().toISOString());
  return {
    product_id: first?.id ?? "",
    name: "",
    description: "",
    promo_rupees: "",
    regular_minor: first?.regular_minor ?? 0,
    starts_date: now.date,
    starts_time: now.time,
    ends_date: now.date,
    ends_time: "23:59",
    is_active: true,
    allow_coupon_stacking: false,
    priority: 0,
  };
}

function fromRecord(record: PromotionRecord, products: ProductOption[]): PromotionFormValues {
  const start = isoToIstParts(record.starts_at);
  const end = isoToIstParts(record.ends_at);
  return {
    product_id: record.product_id,
    name: record.name,
    description: record.description ?? "",
    promo_rupees: (record.promo_amount_minor / 100).toString(),
    regular_minor: products.find((p) => p.id === record.product_id)?.regular_minor ?? 0,
    starts_date: start.date,
    starts_time: start.time,
    ends_date: end.date,
    ends_time: end.time,
    is_active: record.is_active,
    allow_coupon_stacking: record.allow_coupon_stacking,
    priority: record.priority,
  };
}

/**
 * Create / edit form for a promotional price. All times are entered in IST;
 * whether the offer is live remains a server decision.
 */
export function PromotionFormModal({
  open,
  onOpenChange,
  products,
  promotion,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  promotion: PromotionRecord | null;
  saving: boolean;
  onSubmit: (input: PromotionInput) => void;
}) {
  const [values, setValues] = React.useState<PromotionFormValues>(() => emptyValues(products));
  const [errors, setErrors] = React.useState<Record<string, string> | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors(null);
    setValues(promotion ? fromRecord(promotion, products) : emptyValues(products));
  }, [open, promotion, products]);

  const set = <K extends keyof PromotionFormValues>(key: K, value: PromotionFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const regular =
    products.find((p) => p.id === values.product_id)?.regular_minor ?? values.regular_minor;
  const promoMinor = Math.round(Number(values.promo_rupees || 0) * 100);
  const savings = regular > 0 && promoMinor > 0 && promoMinor < regular ? regular - promoMinor : 0;

  const submit = () => {
    const candidate: PromotionFormValues = { ...values, regular_minor: regular };
    const found = promotionFieldErrors(candidate);
    setErrors(found);
    if (found) return;
    onSubmit({
      product_id: candidate.product_id,
      name: candidate.name.trim(),
      description: candidate.description.trim() || null,
      promo_amount_minor: Math.round(Number(candidate.promo_rupees) * 100),
      starts_at: istToIso(candidate.starts_date, candidate.starts_time),
      ends_at: istToIso(candidate.ends_date, candidate.ends_time),
      is_active: candidate.is_active,
      allow_coupon_stacking: candidate.allow_coupon_stacking,
      priority: candidate.priority,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={promotion ? "Edit promotion" : "New promotion"}
      description="Times are entered in India Standard Time. The server decides when the offer goes live and when it ends."
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)}>Cancel</SecondaryButton>
          <PrimaryButton loading={saving} loadingText="Saving…" onClick={submit}>
            {promotion ? "Save changes" : "Create promotion"}
          </PrimaryButton>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <SelectField
          id="promo-product"
          label="Product"
          required
          value={values.product_id}
          onValueChange={(v) => set("product_id", v)}
          options={products.map((p) => ({
            value: p.id,
            label: `${p.name} · ${formatInr(p.regular_minor)}`,
          }))}
          error={errors?.["product_id"]}
        />
        <TextField
          id="promo-name"
          label="Offer name"
          required
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          hint="Shown to students next to the price."
          error={errors?.["name"]}
        />
        <TextField
          id="promo-description"
          label="Internal description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          error={errors?.["description"]}
        />
        <TextField
          id="promo-amount"
          label="Promotional price (₹)"
          required
          inputMode="decimal"
          value={values.promo_rupees}
          onChange={(e) => set("promo_rupees", e.target.value)}
          hint={
            regular > 0
              ? `Regular price ${formatInr(regular)}${savings ? ` · students save ${formatInr(savings)}` : ""}`
              : "This product has no active regular price yet."
          }
          error={errors?.["promo_rupees"]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="promo-start-date"
            label="Starts on (IST)"
            type="date"
            required
            value={values.starts_date}
            onChange={(e) => set("starts_date", e.target.value)}
            error={errors?.["starts_date"]}
          />
          <TextField
            id="promo-start-time"
            label="Start time (IST)"
            type="time"
            required
            value={values.starts_time}
            onChange={(e) => set("starts_time", e.target.value)}
            error={errors?.["starts_time"]}
          />
          <TextField
            id="promo-end-date"
            label="Ends on (IST)"
            type="date"
            required
            value={values.ends_date}
            onChange={(e) => set("ends_date", e.target.value)}
            error={errors?.["ends_date"]}
          />
          <TextField
            id="promo-end-time"
            label="End time (IST)"
            type="time"
            required
            value={values.ends_time}
            onChange={(e) => set("ends_time", e.target.value)}
            error={errors?.["ends_time"]}
          />
        </div>
        <TextField
          id="promo-priority"
          label="Priority"
          type="number"
          min={0}
          max={100}
          value={String(values.priority)}
          onChange={(e) => set("priority", Number(e.target.value || 0))}
          hint="When two offers overlap in time, the higher priority wins."
          error={errors?.["priority"]}
        />
        <CheckboxField
          id="promo-active"
          label="Offer is enabled"
          checked={values.is_active}
          onCheckedChange={(c) => set("is_active", c)}
          hint="Disabled offers never apply, even inside their date window."
        />
        <CheckboxField
          id="promo-stacking"
          label="Allow coupons to stack with this offer"
          checked={values.allow_coupon_stacking}
          onCheckedChange={(c) => set("allow_coupon_stacking", c)}
          hint="Left off, a coupon and this offer never combine — the student simply gets whichever price is lower."
        />
        {errors?.["form"] ? (
          <StatusAlert tone="error" title="Check the form">
            {errors["form"]}
          </StatusAlert>
        ) : null}

      </div>
    </Modal>
  );
}
