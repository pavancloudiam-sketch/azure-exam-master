import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReviewFilters } from "./ReviewFilters";
import type { ReviewFilter } from "../types";

const counts: Record<ReviewFilter, number> = {
  all: 60,
  correct: 42,
  incorrect: 15,
  unanswered: 3,
  marked: 5,
};

describe("ReviewFilters", () => {
  it("renders every filter as a radio with its count", () => {
    render(<ReviewFilters value="all" counts={counts} onChange={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Filter questions" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios.map((r) => r.textContent)).toEqual([
      "All60",
      "Correct42",
      "Incorrect15",
      "Unanswered3",
      "Marked for review5",
    ]);
  });

  it("checks only the active filter", () => {
    render(<ReviewFilters value="incorrect" counts={counts} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /Incorrect/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
  });

  it("emits the selected filter on click", async () => {
    const onChange = vi.fn();
    render(<ReviewFilters value="all" counts={counts} onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /Marked for review/ }));
    expect(onChange).toHaveBeenCalledWith("marked");

    await userEvent.click(screen.getByRole("radio", { name: /Unanswered/ }));
    expect(onChange).toHaveBeenLastCalledWith("unanswered");
  });

  it("renders zero counts instead of hiding empty filters", () => {
    render(
      <ReviewFilters
        value="all"
        counts={{ all: 0, correct: 0, incorrect: 0, unanswered: 0, marked: 0 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /Correct/ })).toHaveTextContent("0");
  });
});
