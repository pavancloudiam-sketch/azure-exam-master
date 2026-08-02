import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SubmitReviewDialog } from "./SubmitReviewDialog";

function setup(props: Partial<React.ComponentProps<typeof SubmitReviewDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <SubmitReviewDialog
      open
      onOpenChange={onOpenChange}
      total={10}
      answered={7}
      unanswered={3}
      marked={2}
      submitting={false}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("SubmitReviewDialog", () => {
  it("summarises answered, unanswered and marked counts", () => {
    setup();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Your exam has 10 questions/)).toBeInTheDocument();
    expect(screen.getByText("Answered").nextSibling).toHaveTextContent("7");
    expect(screen.getByText("Unanswered").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Marked for review").nextSibling).toHaveTextContent("2");
  });

  it("warns about unanswered questions and pluralises correctly", () => {
    setup();
    expect(
      screen.getByText(/3 questions still unanswered — unanswered questions score zero\./),
    ).toBeInTheDocument();
  });

  it("uses the singular form for one unanswered question", () => {
    setup({ answered: 9, unanswered: 1 });
    expect(screen.getByText(/1 question still unanswered/)).toBeInTheDocument();
  });

  it("omits the warning when everything is answered", () => {
    setup({ answered: 10, unanswered: 0 });
    expect(screen.queryByText(/still unanswered/)).not.toBeInTheDocument();
  });

  it("confirms submission and allows keeping working", async () => {
    const { onConfirm, onOpenChange } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

