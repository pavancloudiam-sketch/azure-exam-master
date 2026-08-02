import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReviewPalette } from "./ReviewPalette";
import { makeReviewQuestion } from "@/test/fixtures";

const questions = [
  makeReviewQuestion({ question_id: "a", status: "correct" }),
  makeReviewQuestion({ question_id: "b", status: "incorrect" }),
  makeReviewQuestion({ question_id: "c", status: "unanswered", marked_for_review: true }),
];

describe("ReviewPalette (review navigation)", () => {
  it("labels each question with its status and marked flag", () => {
    render(
      <ReviewPalette questions={questions} numbers={[1, 4, 7]} currentIndex={0} onJump={vi.fn()} />,
    );

    expect(
      screen.getByRole("navigation", { name: "Review question navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 1, Correct" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 4, Incorrect" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Question 7, Unanswered, marked for review" }),
    ).toBeInTheDocument();
  });

  it("uses the original attempt numbering, not the filtered position", () => {
    render(
      <ReviewPalette questions={questions} numbers={[1, 4, 7]} currentIndex={0} onJump={vi.fn()} />,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent?.[0])).toEqual(["1", "4", "7"]);
  });

  it("marks the current question and jumps on click", async () => {
    const onJump = vi.fn();
    render(
      <ReviewPalette questions={questions} numbers={[1, 2, 3]} currentIndex={1} onJump={onJump} />,
    );

    expect(screen.getByRole("button", { name: /Question 2/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: /Question 3/ }));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("renders the status legend", () => {
    render(<ReviewPalette questions={questions} numbers={[1, 2, 3]} currentIndex={0} onJump={vi.fn()} />);
    expect(screen.getByText("C — correct")).toBeInTheDocument();
    expect(screen.getByText("X — incorrect")).toBeInTheDocument();
    expect(screen.getByText("– — unanswered")).toBeInTheDocument();
  });
});
