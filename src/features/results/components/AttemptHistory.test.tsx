import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const listMyAttempts = vi.fn();
vi.mock("@/features/attempts/services/attempt-service", () => ({
  listMyAttempts: (...args: unknown[]) => listMyAttempts(...args),
}));

import { AttemptHistory } from "./AttemptHistory";
import { renderWithQuery } from "@/test/render";

const submitted = {
  id: "att-1",
  exam_id: "e1",
  status: "submitted",
  mode: "timed",
  started_at: "2026-02-01T09:00:00.000Z",
  scaled_score: 810,
  duration_seconds: 3725,
};
const inProgress = { ...submitted, id: "att-2", status: "in_progress", scaled_score: null };
const cancelled = { ...submitted, id: "att-3", status: "cancelled", scaled_score: null };

describe("AttemptHistory (dashboard attempts)", () => {
  it("shows a loading block first", () => {
    listMyAttempts.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<AttemptHistory />);
    expect(screen.getByText("Loading your attempts")).toBeInTheDocument();
  });

  it("shows an empty state when there are no attempts", async () => {
    listMyAttempts.mockResolvedValue([]);
    renderWithQuery(<AttemptHistory />);
    expect(await screen.findByText("No attempts yet")).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    listMyAttempts.mockRejectedValue(new Error("Attempts service down"));
    renderWithQuery(<AttemptHistory />);
    expect(await screen.findByText("Attempts unavailable")).toBeInTheDocument();
    expect(screen.getByText("Attempts service down")).toBeInTheDocument();
  });

  it("renders a completed attempt with its score, duration and result link", async () => {
    listMyAttempts.mockResolvedValue([submitted]);
    renderWithQuery(<AttemptHistory />);

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Timed")).toBeInTheDocument();
    expect(screen.getByText("810 / 1000")).toBeInTheDocument();
    expect(screen.getByText("1h 2m 5s")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View result" })).toBeInTheDocument();
  });

  it("offers Resume for an in-progress attempt and never a score", async () => {
    listMyAttempts.mockResolvedValue([inProgress]);
    renderWithQuery(<AttemptHistory />);

    expect(await screen.findByText("In progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resume" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View result" })).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("shows a cancelled attempt without any action", async () => {
    listMyAttempts.mockResolvedValue([cancelled]);
    renderWithQuery(<AttemptHistory />);

    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders one row per attempt", async () => {
    listMyAttempts.mockResolvedValue([submitted, inProgress, cancelled]);
    renderWithQuery(<AttemptHistory />);

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4)); // header + 3
    expect(listMyAttempts).toHaveBeenCalledTimes(1);
  });
});
