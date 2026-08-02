import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const cancelAttempt = vi.fn();
vi.mock("../services/attempt-service", () => ({
  cancelAttempt: (...args: unknown[]) => cancelAttempt(...args),
  getAttemptTimeRemaining: vi.fn().mockResolvedValue(600),
}));

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/features/shared/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/shared/components/ui")>();
  return { ...actual, notify };
});

const engineState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../hooks/use-exam-engine", () => ({
  useExamEngine: () => engineState.current,
}));

import { ExamRunner } from "./ExamRunner";
import { makeExamQuestion } from "@/test/fixtures";

const questionA = makeExamQuestion({ question_id: "q1", stem: "First question" });
const questionB = makeExamQuestion({ question_id: "q2", stem: "Second question", sort_order: 2 });

function makeEngine(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    error: null,
    attempt: { id: "a1", status: "in_progress", mode: "practice", expires_at: null },
    questions: [questionA, questionB],
    current: questionA,
    index: 0,
    answers: {},
    answeredCount: 0,
    unansweredCount: 2,
    markedCount: 0,
    paletteStates: ["current", "unanswered"],
    saving: false,
    saveError: null,
    pendingSaves: 0,
    offline: false,
    submitting: false,
    conflicts: [],
    goTo: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    selectOption: vi.fn(),
    clearAnswer: vi.fn(),
    toggleMark: vi.fn(),
    submit: vi.fn().mockResolvedValue(true),
    resolveConflicts: vi.fn(),
    ...overrides,
  };
}

function renderRunner(overrides: Record<string, unknown> = {}) {
  const engine = makeEngine(overrides);
  engineState.current = engine;
  render(<ExamRunner attemptId="a1" examTitle="SC-300 Practice Exam" />);
  return engine;
}

beforeEach(() => {
  navigate.mockReset();
  cancelAttempt.mockReset();
});

describe("ExamRunner — states", () => {
  it("shows a loading block while the engine loads", () => {
    renderRunner({ loading: true });
    expect(screen.getByText("Loading your exam")).toBeInTheDocument();
  });

  it("shows an error state when the engine fails", () => {
    renderRunner({ error: "Attempt expired" });
    expect(screen.getByText("Exam unavailable")).toBeInTheDocument();
    expect(screen.getByText("Attempt expired")).toBeInTheDocument();
  });

  it("locks the runner for an already submitted attempt", () => {
    renderRunner({ attempt: { id: "a1", status: "submitted", mode: "timed", expires_at: null } });
    expect(screen.getByText("This attempt is already submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit exam/ })).not.toBeInTheDocument();
  });

  it("explains an exam with no questions", () => {
    renderRunner({ current: null, questions: [], paletteStates: [] });
    expect(screen.getByText("No questions assigned")).toBeInTheDocument();
  });
});

describe("ExamRunner — header and progress", () => {
  it("renders the title, mode and progress counters", () => {
    renderRunner({ answeredCount: 1, markedCount: 1 });
    expect(screen.getByRole("heading", { name: "SC-300 Practice Exam" })).toBeInTheDocument();
    expect(
      screen.getByText(/Practice mode — no timer · Question 1 of 2 · 1 answered · 1 marked/),
    ).toBeInTheDocument();
  });

  it("hides the timer in practice mode and shows it in timed mode", () => {
    renderRunner();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();

    document.body.innerHTML = "";
    renderRunner({
      attempt: {
        id: "a1",
        status: "in_progress",
        mode: "timed",
        expires_at: "2030-01-01T00:00:00Z",
      },
    });
    expect(screen.getByText(/Timed mode/)).toBeInTheDocument();
  });

  it("announces the current question politely to screen readers", () => {
    renderRunner({
      answers: { q1: { selected: ["o1"], markedForReview: true } },
      saving: true,
    });
    const live = document.querySelector("[aria-live='polite']");
    expect(live?.textContent).toContain("Question 1 of 2");
    expect(live?.textContent).toContain("Answered, marked for review");
    expect(live?.textContent).toContain("Saving your answer");
  });
});

describe("ExamRunner — autosave UI", () => {
  it("shows a saving indicator while an answer is in flight", () => {
    renderRunner({ saving: true });
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows the retry indicator for queued answers", () => {
    renderRunner({ pendingSaves: 2 });
    expect(screen.getByText(/Retrying 2 unsaved answers…/)).toBeInTheDocument();
  });

  it("surfaces a save error as reassuring guidance, not a failure", () => {
    renderRunner({ saveError: "Network unreachable." });
    expect(screen.getByText("We're still trying to save your answers")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is lost/)).toBeInTheDocument();
  });

  it("prefers the offline banner over the save error and shows the queue depth", () => {
    renderRunner({ offline: true, pendingSaves: 1, saveError: "Network unreachable." });
    expect(screen.getByText("You are offline")).toBeInTheDocument();
    expect(screen.getByText(/Offline — 1 answer queued/)).toBeInTheDocument();
    expect(screen.queryByText("We're still trying to save your answers")).not.toBeInTheDocument();
  });
});

describe("ExamRunner — navigation", () => {
  it("disables Previous on the first question and Next on the last", () => {
    renderRunner();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();

    document.body.innerHTML = "";
    renderRunner({ current: questionB, index: 1, paletteStates: ["answered", "current"] });
    expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  it("moves with the Next button and the palette", async () => {
    const engine = renderRunner();
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(engine.next).toHaveBeenCalled();

    const palette = screen.getByRole("navigation", { name: "Question navigation" });
    await userEvent.click(within(palette).getByRole("button", { name: /^Question 2,/ }));
    expect(engine.goTo).toHaveBeenCalledWith(1);
  });

  it("supports arrow-key navigation, M to mark, C to clear and digits to answer", async () => {
    const engine = renderRunner();

    await userEvent.keyboard("{ArrowRight}");
    expect(engine.next).toHaveBeenCalled();
    await userEvent.keyboard("{ArrowLeft}");
    expect(engine.previous).toHaveBeenCalled();
    await userEvent.keyboard("m");
    expect(engine.toggleMark).toHaveBeenCalledWith("q1");
    await userEvent.keyboard("c");
    expect(engine.clearAnswer).toHaveBeenCalledWith("q1");
    await userEvent.keyboard("2");
    expect(engine.selectOption).toHaveBeenCalledWith(questionA, "o2");
  });

  it("ignores digits beyond the option count and modifier combinations", async () => {
    const engine = renderRunner();
    await userEvent.keyboard("9");
    await userEvent.keyboard("{Control>}m{/Control}");
    expect(engine.selectOption).not.toHaveBeenCalled();
    expect(engine.toggleMark).not.toHaveBeenCalled();
  });

  it("toggles mark and clear from the toolbar", async () => {
    const engine = renderRunner({ answers: { q1: { selected: ["o1"], markedForReview: true } } });

    const mark = screen.getByRole("button", { name: /Unmark review/ });
    expect(mark).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(mark);
    expect(engine.toggleMark).toHaveBeenCalledWith("q1");

    await userEvent.click(screen.getByRole("button", { name: /Clear answer/ }));
    expect(engine.clearAnswer).toHaveBeenCalledWith("q1");
  });

  it("disables Clear answer when nothing is selected", () => {
    renderRunner();
    expect(screen.getByRole("button", { name: /Clear answer/ })).toBeDisabled();
  });
});

describe("ExamRunner — submit and cancel", () => {
  it("submits through the review dialog and navigates to the result", async () => {
    const engine = renderRunner({ answeredCount: 2, unansweredCount: 0 });

    await userEvent.click(screen.getByRole("button", { name: /Submit exam/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit exam" }));

    expect(engine.submit).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/results/$attemptId",
      params: { attemptId: "a1" },
    });
  });

  it("stays on the exam when submission fails", async () => {
    renderRunner({ submit: vi.fn().mockResolvedValue(false) });

    await userEvent.click(screen.getByRole("button", { name: /Submit exam/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit exam" }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it("cancels an attempt and returns to the dashboard", async () => {
    cancelAttempt.mockResolvedValue(undefined);
    renderRunner();

    await userEvent.click(screen.getByRole("button", { name: /Cancel attempt/ }));
    const dialog = await screen.findByRole("alertdialog").catch(() => screen.findByRole("dialog"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel attempt" }));

    expect(cancelAttempt).toHaveBeenCalledWith("a1");
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
});

describe("ExamRunner — cross-device conflicts", () => {
  it("lists conflicts and resolves them with the chosen side", async () => {
    const engine = renderRunner({
      conflicts: [{ questionId: "q2", localSelected: ["o1"], remoteSelected: ["o2", "o3"] }],
    });

    expect(
      await screen.findByText("This attempt was also answered elsewhere"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Question 2: this device selected 1 option, the other device selected 2\./),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Use the other device's answers/ }));
    expect(engine.resolveConflicts).toHaveBeenCalledWith("remote");
  });

  it("shows no conflict dialog when there are none", () => {
    renderRunner();
    expect(screen.queryByText("This attempt was also answered elsewhere")).not.toBeInTheDocument();
  });
});
