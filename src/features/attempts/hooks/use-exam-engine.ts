import * as React from "react";

import {
  getAttempt,
  getAttemptQuestions,
  listAttemptAnswers,
  saveAnswer,
  submitAttempt,
} from "../services/attempt-service";
import type { AnswerState, Attempt, ExamQuestionView, PaletteState } from "../types";
import {
  describeError,
  errorToastMessage,
  isSessionExpired,
  logError,
} from "@/features/observability";
import {
  AutosaveQueue,
  detectResumeConflicts,
  readPersistedQueue,
  type AutosaveStatus,
  type ResumeConflict,
} from "../services/autosave-queue";

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const IDLE_STATUS: AutosaveStatus = {
  pending: 0,
  flushing: false,
  offline: false,
  error: null,
  lastSavedAt: null,
};

function describeErrorText(cause: unknown, requestId: string): string {
  const described = describeError(cause, requestId);
  return `${described.message} ${described.retryGuidance}${
    described.reference ? ` (ref ${described.reference})` : ""
  }`;
}

function isMulti(type: string) {
  return type.endsWith("multiple_choice");
}

/**
 * Single engine used by both timed and practice modes.
 * The only difference between modes is whether a countdown is running.
 */
export function useExamEngine(attemptId: string) {
  const [attempt, setAttempt] = React.useState<Attempt | null>(null);
  const [questions, setQuestions] = React.useState<ExamQuestionView[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>({});
  const answersRef = React.useRef<Record<string, AnswerState>>({});
  const [index, setIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const submittedRef = React.useRef(false);
  const submitPromise = React.useRef<Promise<boolean> | null>(null);
  // Save failures are recoverable: surface a warning but never tear down
  // an in-progress exam the way a load failure does.
  const [autosave, setAutosave] = React.useState<AutosaveStatus>(IDLE_STATUS);
  const [conflicts, setConflicts] = React.useState<ResumeConflict[]>([]);
  const queueRef = React.useRef<AutosaveQueue | null>(null);

  // One durable queue per attempt. It rehydrates any edits left over from a
  // previous session (refresh, crash, browser restart) and starts draining
  // them as soon as the network allows.
  React.useEffect(() => {
    const queue = new AutosaveQueue({
      attemptId,
      storage: browserStorage(),
      isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine !== false),
      save: (item) =>
        saveAnswer({
          attemptId,
          questionId: item.questionId,
          selected: item.selected,
          markedForReview: item.markedForReview,
        }).catch((cause) => {
          logError("attempt.autosave_failed", "Answer autosave failed", cause, {
            attempt_id: attemptId,
            question_id: item.questionId,
            session_expired: isSessionExpired(cause),
          });
          throw new Error(
            isSessionExpired(cause)
              ? "Your session expired, so this answer isn't saved yet. Sign in again in another tab — we keep retrying."
              : errorToastMessage(cause, ""),
          );
        }),
      onStatus: setAutosave,
    });
    queueRef.current = queue;
    const online = () => queue.setOnline(true);
    const offline = () => queue.setOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      queue.stop();
      queueRef.current = null;
    };
  }, [attemptId]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [attemptRow, questionRows, answerRows] = await Promise.all([
          getAttempt(attemptId),
          getAttemptQuestions(attemptId),
          listAttemptAnswers(attemptId),
        ]);
        if (!active) return;
        if (!attemptRow) {
          setError("Attempt not found.");
          return;
        }
        const map: Record<string, AnswerState> = {};
        for (const row of answerRows) {
          map[row.question_id] = {
            selected: row.selected_option_ids ?? [],
            markedForReview: row.marked_for_review,
          };
        }
        // Replay locally queued edits over the server state so a refresh or
        // reconnect never shows stale answers, and flag genuine conflicts
        // where another device wrote a newer answer.
        const queued = readPersistedQueue(attemptId, browserStorage());
        setConflicts(detectResumeConflicts(queued, answerRows));
        for (const item of queued) {
          map[item.questionId] = {
            selected: item.selected,
            markedForReview: item.markedForReview,
          };
        }
        setAttempt(attemptRow);
        setQuestions(questionRows);
        answersRef.current = map;
        setAnswers(map);
      } catch (cause) {
        const requestId = logError("attempt.load_failed", "Could not load attempt", cause, {
          attempt_id: attemptId,
        });
        if (active) setError(describeErrorText(cause, requestId));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attemptId]);

  const persist = React.useCallback((questionId: string, next: AnswerState) => {
    queueRef.current?.enqueue({
      questionId,
      selected: next.selected,
      markedForReview: next.markedForReview,
    });
  }, []);

  const update = React.useCallback(
    (questionId: string, updater: (current: AnswerState) => AnswerState) => {
      const existing = answersRef.current[questionId] ?? {
        selected: [],
        markedForReview: false,
      };
      const next = updater(existing);
      answersRef.current = { ...answersRef.current, [questionId]: next };
      setAnswers(answersRef.current);
      persist(questionId, next);
    },
    [persist],
  );

  const selectOption = React.useCallback(
    (question: ExamQuestionView, optionId: string) => {
      update(question.question_id, (current) => {
        if (isMulti(question.question_type)) {
          const selected = current.selected.includes(optionId)
            ? current.selected.filter((id) => id !== optionId)
            : [...current.selected, optionId];
          return { ...current, selected };
        }
        return { ...current, selected: [optionId] };
      });
    },
    [update],
  );

  const clearAnswer = React.useCallback(
    (questionId: string) => update(questionId, (current) => ({ ...current, selected: [] })),
    [update],
  );

  const toggleMark = React.useCallback(
    (questionId: string) =>
      update(questionId, (current) => ({
        ...current,
        markedForReview: !current.markedForReview,
      })),
    [update],
  );

  const goTo = React.useCallback(
    (next: number) =>
      setIndex((current) => {
        if (questions.length === 0) return current;
        return Math.min(Math.max(next, 0), questions.length - 1);
      }),
    [questions.length],
  );

  const submit = React.useCallback(async () => {
    // Duplicate-submission guard: a second call while the first is running
    // (double click, Enter key, timer expiry racing the button) reuses the
    // in-flight promise instead of scoring the attempt twice.
    if (submittedRef.current) return true;
    if (submitPromise.current) return submitPromise.current;
    const run = (async () => {
      setSubmitting(true);
      try {
        // Never submit with answers still queued locally.
        await queueRef.current?.drain();
        const submitted = await submitAttempt(attemptId);
        submittedRef.current = true;
        queueRef.current?.clearPersisted();
        setAttempt(submitted);
        return true;
      } catch (cause) {
        // Scoring runs inside submit_attempt, so a failure here covers both
        // submission and scoring; the context distinguishes them.
        const requestId = logError("attempt.submit_failed", "Attempt submission failed", cause, {
          attempt_id: attemptId,
          session_expired: isSessionExpired(cause),
        });
        setError(describeErrorText(cause, requestId));
        return false;
      } finally {
        setSubmitting(false);
        submitPromise.current = null;
      }
    })();
    submitPromise.current = run;
    return run;
  }, [attemptId]);

  /** Conflict resolution: keep this device's answers, or take the server's. */
  const resolveConflicts = React.useCallback(
    (choice: "local" | "remote") => {
      const pending = conflicts;
      setConflicts([]);
      if (choice === "local") {
        for (const conflict of pending) {
          const state = answersRef.current[conflict.questionId];
          if (state) persist(conflict.questionId, state);
        }
        return;
      }
      const next = { ...answersRef.current };
      for (const conflict of pending) {
        next[conflict.questionId] = {
          selected: conflict.remoteSelected,
          markedForReview: next[conflict.questionId]?.markedForReview ?? false,
        };
      }
      answersRef.current = next;
      setAnswers(next);
      for (const conflict of pending) {
        persist(conflict.questionId, next[conflict.questionId]!);
      }
    },
    [conflicts, persist],
  );

  const paletteStates: PaletteState[] = React.useMemo(
    () =>
      questions.map((question, position) => {
        const state = answers[question.question_id];
        const answered = (state?.selected.length ?? 0) > 0;
        const marked = state?.markedForReview ?? false;
        if (position === index) return "current";
        if (answered && marked) return "answered-marked";
        if (marked) return "marked";
        return answered ? "answered" : "unanswered";
      }),
    [answers, index, questions],
  );

  const answeredCount = React.useMemo(
    () =>
      questions.filter((question) => (answers[question.question_id]?.selected.length ?? 0) > 0)
        .length,
    [answers, questions],
  );

  const markedCount = React.useMemo(
    () => questions.filter((question) => answers[question.question_id]?.markedForReview).length,
    [answers, questions],
  );

  const unansweredCount = questions.length - answeredCount;

  return {
    attempt,
    questions,
    answers,
    index,
    current: questions[index] ?? null,
    loading,
    error,
    saveError: autosave.error,
    offline: autosave.offline,
    pendingSaves: autosave.pending,
    conflicts,
    resolveConflicts,
    submitting,
    saving: autosave.flushing,
    answeredCount,
    unansweredCount,
    markedCount,
    paletteStates,
    goTo,
    next: () => goTo(index + 1),
    previous: () => goTo(index - 1),
    selectOption,
    clearAnswer,
    toggleMark,
    submit,
  };
}
