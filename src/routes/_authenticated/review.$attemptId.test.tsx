import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useParams: () => ({ attemptId: "att-1" }),
  }),
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

const reviewState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/features/review/hooks", () => ({
  useAttemptReview: () => reviewState.current,
}));

const getAttemptResult = vi.fn();
vi.mock("@/features/results/services/result-service", () => ({
  getAttemptResult: (...args: unknown[]) => getAttemptResult(...args),
}));

import { Route } from "./review.$attemptId";
import { renderWithQuery } from "@/test/render";
import { makeAttemptResult, makeReviewQuestion } from "@/test/fixtures";

const questions = [
  makeReviewQuestion({ question_id: "a", stem: "Question A", status: "correct" }),
  makeReviewQuestion({ question_id: "b", stem: "Question B", status: "incorrect" }),
  makeReviewQuestion({
    question_id: "c",
    stem: "Question C",
    status: "unanswered",
    marked_for_review: true,
  }),
];

function makeReview(overrides: Record<string, unknown> = {}) {
  const visible = (overrides["visible"] as typeof questions) ?? questions;
  return {
    loading: false,
    error: null,
    refetch: vi.fn(),
    questions,
    visible,
    counts: { all: 3, correct: 1, incorrect: 1, unanswered: 1, marked: 1 },
    filter: "all",
    setFilter: vi.fn(),
    index: 0,
    setIndex: vi.fn(),
    current: visible[0] ?? null,
    questionNumber: visible[0] ? questions.indexOf(visible[0]) + 1 : 0,
    goPrevious: vi.fn(),
    goNext: vi.fn(),
    ...overrides,
  };
}

function renderReview(overrides: Record<string, unknown> = {}) {
  const review = makeReview(overrides);
  reviewState.current = review;
  const Component = (Route as unknown as { options: { component: () => React.ReactElement } })
    .options.component;
  renderWithQuery(<Component />);
  return review;
}

beforeEach(() => {
  getAttemptResult.mockResolvedValue(makeAttemptResult());
});

describe("Review route", () => {
  it("renders the page shell and back links", () => {
    renderReview();
    expect(screen.getByRole("heading", { level: 1, name: "Review answers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to results" })).toBeInTheDocument();
  });

  it("renders filters, palette and the current question card together", async () => {
    renderReview();

    expect(screen.getByRole("radiogroup", { name: "Filter questions" })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Review question navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Question A" })).toBeInTheDocument();
  });

  it("changes the filter through the toolbar", async () => {
    const review = renderReview();
    await userEvent.click(screen.getByRole("radio", { name: /Incorrect/ }));
    expect(review.setFilter).toHaveBeenCalledWith("incorrect");
  });

  it("navigates between filtered questions with the palette", async () => {
    const review = renderReview();
    const nav = screen.getByRole("navigation", { name: "Review question navigation" });
    await userEvent.click(nav.querySelectorAll("button")[2]!);
    expect(review.setIndex).toHaveBeenCalledWith(2);
  });

  it("only renders questions the filter left visible", () => {
    renderReview({ visible: [questions[1]!], filter: "incorrect" });
    expect(screen.getByRole("heading", { level: 2, name: "Question B" })).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Review question navigation" }).querySelectorAll(
        "button",
      ),
    ).toHaveLength(1);
  });

  it("shows a loading state while the review loads", () => {
    renderReview({ loading: true, visible: [], current: null });
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("shows an error state when the review cannot be loaded", () => {
    renderReview({ error: new Error("Not your attempt"), visible: [], current: null });
    expect(screen.getByText("Not your attempt")).toBeInTheDocument();
  });

  it("declares noindex head metadata", () => {
    type MetaTag = { title?: string; name?: string; property?: string; content?: string };
    const head = (Route as unknown as { options: { head: () => { meta: MetaTag[] } } }).options
      .head;
    const tags = head().meta;
    expect(tags.find((tag) => tag["title"])?.["title"]).toBe("Review answers — AskMeExam");
    expect(tags.find((tag) => tag["name"] === "robots")?.["content"]).toBe("noindex");
  });
});
