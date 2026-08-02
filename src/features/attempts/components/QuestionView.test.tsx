import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuestionView } from "./QuestionView";
import { makeAnswer, makeExamQuestion } from "@/test/fixtures";

describe("QuestionView", () => {
  it("renders the stem, position and single-choice radios", () => {
    render(
      <QuestionView
        question={makeExamQuestion()}
        position={2}
        total={10}
        answer={makeAnswer()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Which Entra ID feature enforces MFA per application?",
    );
    expect(screen.getByText("Question 3 of 10")).toBeInTheDocument();
    expect(screen.getByText("Select one")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("renders checkboxes and the multi-select hint for multiple-choice questions", () => {
    render(
      <QuestionView
        question={makeExamQuestion({ question_type: "multiple_choice" })}
        position={0}
        total={3}
        answer={makeAnswer()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Select all that apply")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("shows the scenario block only when a scenario exists", () => {
    const { rerender } = render(
      <QuestionView
        question={makeExamQuestion()}
        position={0}
        total={1}
        answer={makeAnswer()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText("Scenario")).not.toBeInTheDocument();

    rerender(
      <QuestionView
        question={makeExamQuestion({ scenario: "Contoso has two tenants." })}
        position={0}
        total={1}
        answer={makeAnswer()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Scenario")).toBeInTheDocument();
    expect(screen.getByText("Contoso has two tenants.")).toBeInTheDocument();
  });

  it("reflects the selected answer and the marked badge", () => {
    render(
      <QuestionView
        question={makeExamQuestion()}
        position={0}
        total={1}
        answer={makeAnswer({ selected: ["o2"], markedForReview: true })}
        onSelect={vi.fn()}
      />,
    );

    const options = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(options[1]).toBeChecked();
    expect(options[0]).not.toBeChecked();
    expect(screen.getByText("Marked")).toBeInTheDocument();
  });

  it("calls onSelect with the option id when an option is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <QuestionView
        question={makeExamQuestion()}
        position={0}
        total={1}
        answer={makeAnswer()}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: /Access reviews/ }));
    expect(onSelect).toHaveBeenCalledWith("o2");
  });

  it("never renders answer-key information", () => {
    render(
      <QuestionView
        question={makeExamQuestion()}
        position={0}
        total={1}
        answer={makeAnswer()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/explanation/i)).not.toBeInTheDocument();
  });
});
