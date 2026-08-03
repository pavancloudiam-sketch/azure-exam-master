import { describe, expect, it } from "vitest";

import {
  istToIso,
  isoToIstParts,
  promotionFieldErrors,
  type PromotionFormValues,
} from "./promotion-schemas";
import { promotionStatus } from "../types/pricing";

const base: PromotionFormValues = {
  product_id: "d90b218b-fba0-4b23-9f86-c6f698f275d4",
  name: "Launch Offer",
  description: "",
  promo_rupees: "300",
  regular_minor: 50000,
  starts_date: "2026-08-01",
  starts_time: "00:00",
  ends_date: "2026-09-02",
  ends_time: "23:59",
  is_active: true,
  allow_coupon_stacking: false,
  priority: 0,
};

describe("promotion form validation", () => {
  it("accepts a well-formed offer", () => {
    expect(promotionFieldErrors(base)).toBeNull();
  });

  it("rejects a promotional price at or above the regular price", () => {
    expect(promotionFieldErrors({ ...base, promo_rupees: "500" })?.["promo_rupees"]).toMatch(
      /lower than the regular price/,
    );
  });

  it("rejects an end date that is not after the start", () => {
    expect(
      promotionFieldErrors({ ...base, ends_date: "2026-08-01", ends_time: "00:00" })?.["ends_date"],
    ).toMatch(/end after it starts/);
  });

  it("requires a name", () => {
    expect(promotionFieldErrors({ ...base, name: "x" })?.["name"]).toBeTruthy();
  });
});

describe("IST conversion", () => {
  it("anchors entered times to India Standard Time", () => {
    expect(istToIso("2026-09-02", "23:59")).toBe("2026-09-02T18:29:00.000Z");
  });

  it("round-trips a stored timestamp back to IST inputs", () => {
    expect(isoToIstParts("2026-09-02T18:29:00.000Z")).toEqual({
      date: "2026-09-02",
      time: "23:59",
    });
  });
});

describe("promotionStatus", () => {
  const promo = { is_active: true, starts_at: "2026-08-01T00:00:00Z", ends_at: "2026-09-02T00:00:00Z" };

  it("is scheduled before the window", () => {
    expect(promotionStatus(promo, new Date("2026-07-01T00:00:00Z"))).toBe("Scheduled");
  });

  it("is active inside the window", () => {
    expect(promotionStatus(promo, new Date("2026-08-15T00:00:00Z"))).toBe("Active");
  });

  it("is expired after the window", () => {
    expect(promotionStatus(promo, new Date("2026-09-03T00:00:00Z"))).toBe("Expired");
  });

  it("is disabled when switched off inside the window", () => {
    expect(
      promotionStatus({ ...promo, is_active: false }, new Date("2026-08-15T00:00:00Z")),
    ).toBe("Disabled");
  });

  it("is a draft when switched off before it starts", () => {
    expect(promotionStatus({ ...promo, is_active: false }, new Date("2026-07-01T00:00:00Z"))).toBe(
      "Draft",
    );
  });
});
