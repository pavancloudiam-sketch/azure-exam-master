import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ResultSummary } from "./ResultSummary";
import { makeAttemptResult } from "@/test/fixtures";

describe("ResultSummary (results screen)", () => {
  it("renders the exam title, mode and a pass verdict", () => {
    render(<ResultSummary result={makeAttemptResult()} />);

    expect(screen.getByRole("heading", { name: "SC-300 Practice Exam" })).toBeInTheDocument();
    expect(screen.getByText(/Timed mode/)).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("renders a fail verdict for a failed attempt", () => {
    render(
      <ResultSummary
        result={makeAttemptResult({ passed: false, scaled_score: 610, percentage: 58.333 })}
      />,
    );
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(screen.getByText("58.33%")).toBeInTheDocument();
  });

  it("renders every score stat including the passing threshold", () => {
    render(<ResultSummary result={makeAttemptResult()} />);

    const score = within(screen.getByRole("region", { name: "Score" }));
    expect(score.getByText("720 / 1000")).toBeInTheDocument();
    expect(score.getByText("Passing score 700")).toBeInTheDocument();
    expect(score.getByText("70.00%")).toBeInTheDocument();
    expect(score.getByText("42 / 60")).toBeInTheDocument();
    expect(score.getByText("1h 2m 5s")).toBeInTheDocument();
  });

  it("renders question counters", () => {
    render(<ResultSummary result={makeAttemptResult()} />);

    const questions = within(screen.getByRole("region", { name: "Questions" }));
    expect(questions.getByText("Total questions").nextSibling).toHaveTextContent("60");
    expect(questions.getByText("Correct").nextSibling).toHaveTextContent("42");
    expect(questions.getByText("Incorrect").nextSibling).toHaveTextContent("15");
    expect(questions.getByText("Unanswered").nextSibling).toHaveTextContent("3");
  });

  it("renders the per-domain table with one row per domain", () => {
    render(<ResultSummary result={makeAttemptResult()} />);

    const rows = screen.getAllByRole("row");
    // header + two domains
    expect(rows).toHaveLength(3);
    expect(screen.getByRole("rowheader", { name: "Identity fundamentals" })).toBeInTheDocument();
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("65.0%")).toBeInTheDocument();
  });

  it("explains when there is no domain data", () => {
    render(<ResultSummary result={makeAttemptResult({ domains: [] })} />);
    expect(screen.getByText("No domain data for this attempt.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the non-official scoring disclaimer visible", () => {
    render(<ResultSummary result={makeAttemptResult()} />);
    expect(
      screen.getByText(/not Microsoft's official scoring method/),
    ).toBeInTheDocument();
  });
});
