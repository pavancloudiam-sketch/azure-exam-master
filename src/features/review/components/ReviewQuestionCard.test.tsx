import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ReviewQuestionCard } from "./ReviewQuestionCard";
import { makeReviewQuestion } from "@/test/fixtures";

describe("ReviewQuestionCard", () => {
  it("renders the stem, position, status and metadata", () => {
    render(<ReviewQuestionCard question={makeReviewQuestion()} number={3} total={60} />);

    expect(screen.getByText("Question 3 of 60")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "What does Conditional Access evaluate?",
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("1 point")).toBeInTheDocument();
    expect(screen.getByText("Identity fundamentals")).toBeInTheDocument();
    expect(screen.getByText("Conditional Access")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("marks the correct answer and the student's answer on the options", () => {
    render(
      <ReviewQuestionCard
        question={makeReviewQuestion({ status: "incorrect", selected_option_ids: ["ro2"] })}
        number={1}
        total={2}
      />,
    );

    const options = within(screen.getByRole("region", { name: "Answer options" }));
    expect(options.getByText("Correct answer")).toBeInTheDocument();
    expect(options.getByText("Your answer")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });

  it("reports an unanswered question without inventing a selection", () => {
    render(
      <ReviewQuestionCard
        question={makeReviewQuestion({ status: "unanswered", selected_option_ids: [] })}
        number={1}
        total={1}
      />,
    );

    expect(screen.getByText("Unanswered")).toBeInTheDocument();
    expect(screen.getByText("Not answered")).toBeInTheDocument();
  });

  it("shows the explanation, and a fallback when none was recorded", () => {
    const { rerender } = render(
      <ReviewQuestionCard question={makeReviewQuestion()} number={1} total={1} />,
    );
    expect(
      screen.getByText("Signals such as user, device, location and risk."),
    ).toBeInTheDocument();

    rerender(
      <ReviewQuestionCard
        question={makeReviewQuestion({ explanation: null })}
        number={1}
        total={1}
      />,
    );
    expect(
      screen.getByText("No explanation was recorded for this question."),
    ).toBeInTheDocument();
  });

  it("falls back gracefully for uncategorised questions and shows the marked badge", () => {
    render(
      <ReviewQuestionCard
        question={makeReviewQuestion({
          domain_name: null,
          topic_name: null,
          marked_for_review: true,
          points: 2,
        })}
        number={1}
        total={1}
      />,
    );

    expect(screen.getAllByText("Not categorised")).toHaveLength(2);
    expect(screen.getByText("Marked for review")).toBeInTheDocument();
    expect(screen.getByText("2 points")).toBeInTheDocument();
  });

  it("renders a scenario section when present and nothing editable", () => {
    render(
      <ReviewQuestionCard
        question={makeReviewQuestion({ scenario: "Contoso runs hybrid identity." })}
        number={1}
        total={1}
      />,
    );

    expect(screen.getByText("Contoso runs hybrid identity.")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
