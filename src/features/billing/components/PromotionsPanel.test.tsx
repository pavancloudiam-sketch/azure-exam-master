import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

const promo = {
  id: "p1",
  product_id: "prod1",
  name: "Limited-Time Launch Offer",
  description: null,
  currency: "INR",
  promo_amount_minor: 30000,
  starts_at: "2020-01-01T00:00:00Z",
  ends_at: "2999-01-01T00:00:00Z",
  time_zone: "Asia/Kolkata",
  is_active: true,
  allow_coupon_stacking: false,
  priority: 0,
  created_at: "2020-01-01T00:00:00Z",
  updated_at: "2020-01-01T00:00:00Z",
  created_by: null,
  updated_by: null,
  products: { name: "Entra ID Mock Exam" },
};

vi.mock("@/features/billing/services/pricing-service", () => ({
  listPromotions: vi.fn(async () => [promo]),
  getPromotionReport: vi.fn(async () => [
    {
      promotion_id: "p1",
      name: promo.name,
      product_id: "prod1",
      product_name: "Entra ID Mock Exam",
      promo_amount_minor: 30000,
      starts_at: promo.starts_at,
      ends_at: promo.ends_at,
      time_zone: "Asia/Kolkata",
      is_active: true,
      allow_coupon_stacking: false,
      priority: 0,
      paid_orders: 4,
      pending_orders: 1,
      expired_orders: 0,
      students: 4,
      gross_minor: 200000,
      discount_minor: 80000,
      collected_minor: 120000,
    },
  ]),
  getPricingSalesSummary: vi.fn(async () => ({
    regular_orders: 2,
    promotional_orders: 4,
    gross_minor: 300000,
    promotional_discount_minor: 80000,
    coupon_discount_minor: 0,
    collected_minor: 220000,
    pending_promotional_orders: 1,
    expired_promotional_orders: 0,
  })),
  listProductsWithPrices: vi.fn(async () => [
    {
      id: "prod1",
      name: "Entra ID Mock Exam",
      code: "entra",
      is_active: true,
      prices: [{ id: "pr1", amount_minor: 50000, is_active: true }],
    },
  ]),
  getPublicPricing: vi.fn(async () => []),
  listActorLabels: vi.fn(async () => ({})),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
}));

import { PromotionsPanel } from "./PromotionsPanel";

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PromotionsPanel />
    </QueryClientProvider>,
  );
}

describe("PromotionsPanel", () => {
  it("lists a live promotion with its regular and promotional price", async () => {
    renderPanel();

    expect(await screen.findByText("Limited-Time Launch Offer")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
    expect(screen.getByText("₹300.00")).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
  });

  it("summarises promotional sales", async () => {
    renderPanel();

    expect(await screen.findByText("Promotional orders")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("4 paid")).toBeInTheDocument());
  });
});
