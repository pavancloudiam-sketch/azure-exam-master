import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const getAttemptTimeRemaining = vi.fn();
vi.mock("../services/attempt-service", () => ({
  getAttemptTimeRemaining: (...args: unknown[]) => getAttemptTimeRemaining(...args),
}));

import { ExamTimer } from "./ExamTimer";

/** Lets the pending server-clock sync promise settle inside fake timers. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function tick(seconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

describe("ExamTimer", () => {
  let now = 0;

  beforeEach(() => {
    now = 0;
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    // Every tick advances the monotonic clock alongside the timer.
    vi.spyOn(globalThis, "setInterval");
    getAttemptTimeRemaining.mockResolvedValue(125);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function advance(seconds: number) {
    for (let i = 0; i < seconds; i += 1) {
      now += 1000;
      await tick(1);
    }
  }

  it("renders nothing until the server clock answers", async () => {
    let resolve: (value: number) => void = () => {};
    getAttemptTimeRemaining.mockReturnValue(
      new Promise<number>((r) => {
        resolve = r;
      }),
    );
    const { container } = render(<ExamTimer attemptId="a1" onExpire={vi.fn()} />);
    expect(container.textContent).toBe("");

    await act(async () => {
      resolve(60);
    });
    expect(screen.getByRole("timer")).toBeInTheDocument();
  });

  it("shows mm:ss anchored to the server value and counts down", async () => {
    render(<ExamTimer attemptId="a1" onExpire={vi.fn()} />);
    await flush();

    expect(screen.getByRole("timer")).toHaveTextContent("02:05");
    await advance(5);
    expect(screen.getByRole("timer")).toHaveTextContent("02:00");
  });

  it("formats hours when more than an hour remains", async () => {
    getAttemptTimeRemaining.mockResolvedValue(3725);
    render(<ExamTimer attemptId="a1" onExpire={vi.fn()} />);
    await flush();

    expect(screen.getByRole("timer")).toHaveTextContent("1:02:05");
  });

  it("does not announce every tick but announces milestones", async () => {
    getAttemptTimeRemaining.mockResolvedValue(61);
    render(<ExamTimer attemptId="a1" onExpire={vi.fn()} />);
    await flush();

    expect(screen.getByRole("timer")).toHaveAttribute("aria-live", "off");
    await advance(1);
    expect(screen.getByText("60 seconds remaining")).toBeInTheDocument();
  });

  it("fires onExpire exactly once when the clock reaches zero", async () => {
    getAttemptTimeRemaining.mockResolvedValue(2);
    const onExpire = vi.fn();
    render(<ExamTimer attemptId="a1" onExpire={onExpire} />);
    await flush();

    await advance(6);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByText("Time is up. Your exam is being submitted.")).toBeInTheDocument();
  });

  it("keeps counting from the last anchor when a re-sync fails", async () => {
    render(<ExamTimer attemptId="a1" onExpire={vi.fn()} />);
    await flush();
    getAttemptTimeRemaining.mockRejectedValue(new Error("network"));

    await advance(35);
    await flush();
    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
  });

  it("clears its intervals on unmount", async () => {
    const clear = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = render(<ExamTimer attemptId="a1" onExpire={vi.fn()} />);
    await flush();
    unmount();
    expect(clear).toHaveBeenCalledTimes(2);
  });
});
