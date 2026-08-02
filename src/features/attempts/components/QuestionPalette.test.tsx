import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuestionPalette, PALETTE_LEGEND } from "./QuestionPalette";
import { PALETTE_SAMPLE } from "@/test/fixtures";

describe("QuestionPalette (question navigation)", () => {
  it("renders one numbered button per question inside a labelled nav", () => {
    render(<QuestionPalette states={PALETTE_SAMPLE} onJump={vi.fn()} />);

    expect(screen.getByRole("navigation", { name: "Question navigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(PALETTE_SAMPLE.length);
    expect(screen.getByRole("button", { name: /^Question 1,/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /^Question 5,/ })).toHaveTextContent("5");
  });

  it("exposes each state in the accessible name rather than by colour alone", () => {
    render(<QuestionPalette states={PALETTE_SAMPLE} onJump={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Question 1, current question" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 2, answered" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 3, not answered" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 4, marked for review" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Question 5, answered and marked for review" }),
    ).toBeInTheDocument();
  });

  it("marks only the current question with aria-current", () => {
    render(<QuestionPalette states={PALETTE_SAMPLE} onJump={vi.fn()} />);

    const current = screen.getByRole("button", { name: /current question/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(
      screen.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "true"),
    ).toHaveLength(1);
  });

  it("jumps to the clicked question index", async () => {
    const onJump = vi.fn();
    render(<QuestionPalette states={PALETTE_SAMPLE} onJump={onJump} />);

    await userEvent.click(screen.getByRole("button", { name: /^Question 4,/ }));
    expect(onJump).toHaveBeenCalledWith(3);
  });

  it("renders the full legend", () => {
    render(<QuestionPalette states={PALETTE_SAMPLE} onJump={vi.fn()} />);
    for (const item of PALETTE_LEGEND) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it("renders nothing but the legend when there are no questions", () => {
    render(<QuestionPalette states={[]} onJump={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
