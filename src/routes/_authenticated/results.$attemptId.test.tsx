import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useParams: () => ({ attemptId: "att-1" }),
  }),
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const getAttemptResult = vi.fn();
vi.mock("@/features/results/services/result-service", () => ({
  getAttemptResult: (attemptId: string) => getAttemptResult(attemptId),
}));

const notifyResultAvailable = vi.fn((_attemptId: string) => Promise.resolve());
vi.mock("@/features/billing/services/billing-service", () => ({
  notifyResultAvailable: (attemptId: string) => notifyResultAvailable(attemptId),
}));

vi.mock("@/features/ai/components/AiCoachPanel", () => ({
  AiCoachPanel: () => <div data-testid="ai-coach-panel" />,
}));

import { Route } from "./results.$attemptId";
import { makeAttemptResult } from "@/test/fixtures";

const ResultPage = Route.options.component as () => React.ReactElement;

describe("Results route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading block until the result resolves", () => {
    getAttemptResult.mockReturnValue(new Promise(() => {}));
    render(<ResultPage />);
    expect(screen.getAllByText(/Loading your result/).length).toBeGreaterThan(0);
  });

  it("renders the score summary and the review link once loaded", async () => {
    getAttemptResult.mockResolvedValue(
      makeAttemptResult({ exam_title: "Entra ID Practice", percentage: 82, passed: true }),
    );

    render(<ResultPage />);

    expect(await screen.findByText("Entra ID Practice")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Review answers" });
    expect(link).toHaveAttribute("href", "/review/$attemptId");
    expect(screen.getByTestId("ai-coach-panel")).toBeInTheDocument();
  });

  it("queues the result-available notification exactly once", async () => {
    getAttemptResult.mockResolvedValue(makeAttemptResult());
    render(<ResultPage />);
    await screen.findByTestId("ai-coach-panel");
    expect(notifyResultAvailable).toHaveBeenCalledTimes(1);
    expect(notifyResultAvailable).toHaveBeenCalledWith("att-1");
  });

  it("shows an error state when the result cannot be loaded", async () => {
    getAttemptResult.mockRejectedValue(new Error("Result service is down"));
    render(<ResultPage />);
    expect(await screen.findByText("Result unavailable")).toBeInTheDocument();
    expect(screen.getByText("Result service is down")).toBeInTheDocument();
  });

  it("explains when an attempt has no result", async () => {
    getAttemptResult.mockResolvedValue(null);
    render(<ResultPage />);
    expect(await screen.findByText("No result for this attempt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("declares noindex head metadata", () => {
    const head = (Route.options.head as () => { meta: Array<Record<string, string>> })();
    expect(head.meta).toContainEqual({ title: "Exam result — AskMeExam" });
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex" });
  });
});
