import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Flag,
  WifiOff,
  XCircle,
} from "lucide-react";

import {
  ConfirmDialog,
  ErrorState,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  StatusAlert,
  notify,
} from "@/features/shared/components/ui";
import { Modal } from "@/features/shared/components/ui";
import { useExamEngine } from "../hooks/use-exam-engine";
import { CaseStudyPanel } from "./CaseStudyPanel";
import { cancelAttempt } from "../services/attempt-service";
import { ExamTimer } from "./ExamTimer";
import { QuestionPalette } from "./QuestionPalette";
import { QuestionView } from "./QuestionView";
import { SubmitReviewDialog } from "./SubmitReviewDialog";
import { isQuestionAnswered } from "../types";

export function ExamRunner({ attemptId, examTitle }: { attemptId: string; examTitle: string }) {
  const engine = useExamEngine(attemptId);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const {
    attempt,
    current,
    index,
    questions,
    answers,
    goTo,
    next,
    previous,
    selectOption,
    setStatement,
    clearAnswer,
    toggleMark,
    submit,
  } = engine;

  const finish = React.useCallback(
    async (auto: boolean) => {
      const ok = await submit();
      if (ok) {
        setConfirmOpen(false);
        notify.success(auto ? "Time is up — exam submitted" : "Exam submitted");
        void navigate({ to: "/results/$attemptId", params: { attemptId } });
      }
    },
    [attemptId, navigate, submit],
  );

  const abandon = React.useCallback(async () => {
    try {
      await cancelAttempt(attemptId);
      notify.success("Attempt cancelled — it will not be scored");
      void navigate({ to: "/dashboard" });
    } catch (cause) {
      notify.error(cause instanceof Error ? cause.message : "Could not cancel the attempt.");
    }
  }, [attemptId, navigate]);

  // Keyboard navigation: arrows move between questions, 1-9 pick an option,
  // M marks for review, C clears. Ignored while typing in a field.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!current) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key.toLowerCase() === "m") {
        toggleMark(current.question_id);
      } else if (event.key.toLowerCase() === "c") {
        clearAnswer(current.question_id);
      } else if (/^[1-9]$/.test(event.key) && current.question_type !== "yes_no") {
        const option = current.options[Number(event.key) - 1];
        if (option) selectOption(current, option.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearAnswer, current, next, previous, selectOption, toggleMark]);

  if (engine.loading) return <LoadingBlock label="Loading your exam" />;
  if (engine.error) return <ErrorState title="Exam unavailable" description={engine.error} />;
  if (!attempt) return <ErrorState title="Attempt not found" />;
  if (attempt.status !== "in_progress") {
    return (
      <StatusAlert tone="info" title="This attempt is already submitted">
        Your answers are locked. Results and review become available from your dashboard.
      </StatusAlert>
    );
  }
  if (!current) {
    return (
      <StatusAlert tone="warning" title="No questions assigned">
        This exam has no questions assigned yet. Please contact your administrator.
      </StatusAlert>
    );
  }

  const answer = answers[current.question_id] ?? { selected: [], markedForReview: false };
  const caseStudy = engine.currentCaseStudy;
  const caseStudyQuestionNumbers = caseStudy
    ? questions
        .map((question, position) => (question.case_study_id === caseStudy.id ? position + 1 : 0))
        .filter((value) => value > 0)
    : [];
  const timed = attempt.mode === "timed" && attempt.expires_at;
  const answeredNow = isQuestionAnswered(current, answer);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl">{examTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {attempt.mode === "timed" ? "Timed mode" : "Practice mode — no timer"} · Question{" "}
            {index + 1} of {questions.length} · {engine.answeredCount} answered ·{" "}
            {engine.markedCount} marked
          </p>
        </div>
        <div className="flex items-center gap-3">
          {engine.offline ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <WifiOff className="size-3.5" aria-hidden="true" /> Offline — {engine.pendingSaves}{" "}
              answer{engine.pendingSaves === 1 ? "" : "s"} queued
            </span>
          ) : engine.saving ? (
            <span className="text-xs text-muted-foreground">Saving…</span>
          ) : engine.pendingSaves > 0 ? (
            <span className="text-xs text-muted-foreground">
              Retrying {engine.pendingSaves} unsaved answer
              {engine.pendingSaves === 1 ? "" : "s"}…
            </span>
          ) : null}
          {timed ? <ExamTimer attemptId={attemptId} onExpire={() => void finish(true)} /> : null}
          <PrimaryButton onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 aria-hidden="true" /> Submit exam
          </PrimaryButton>
          <SecondaryButton onClick={() => setCancelOpen(true)}>
            <XCircle aria-hidden="true" /> Cancel attempt
          </SecondaryButton>
        </div>
      </header>

      {/* Screen-reader status line. Politely announces the question you moved
          to, whether it is answered, and whether an autosave is in flight, so
          keyboard and screen-reader users get the same feedback as the
          visible header. */}
      <p aria-live="polite" className="sr-only">
        {`Question ${index + 1} of ${questions.length}. ${
          answeredNow ? "Answered" : "Not answered"
        }${answer.markedForReview ? ", marked for review" : ""}.${
          engine.saving ? " Saving your answer." : ""
        }`}
      </p>

      {engine.offline ? (
        <StatusAlert tone="warning" title="You are offline">
          Keep answering — your answers are stored on this device and sent automatically as soon as
          the connection returns.
        </StatusAlert>
      ) : engine.saveError ? (
        <StatusAlert tone="warning" title="We're still trying to save your answers">
          {engine.saveError} Nothing is lost — queued answers keep retrying automatically.
        </StatusAlert>
      ) : null}

      <div
        className={
          caseStudy
            ? "grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_240px]"
            : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]"
        }
      >
        {caseStudy ? (
          <CaseStudyPanel caseStudy={caseStudy} questionNumbers={caseStudyQuestionNumbers} />
        ) : null}
        <div>
          <QuestionView
            question={current}
            position={index}
            total={questions.length}
            answer={answer}
            onSelect={(optionId) => selectOption(current, optionId)}
            onStatement={(statementId, value) => setStatement(current, statementId, value)}
          />

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <SecondaryButton onClick={previous} disabled={index === 0}>
              <ChevronLeft aria-hidden="true" /> Previous
            </SecondaryButton>
            <SecondaryButton onClick={next} disabled={index === questions.length - 1}>
              Next <ChevronRight aria-hidden="true" />
            </SecondaryButton>
            <SecondaryButton
              onClick={() => toggleMark(current.question_id)}
              aria-pressed={answer.markedForReview}
            >
              <Flag aria-hidden="true" />
              {answer.markedForReview ? "Unmark review" : "Mark for review"}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => clearAnswer(current.question_id)}
              disabled={!answeredNow && answer.selected.length === 0}
            >
              <Eraser aria-hidden="true" /> Clear answer
            </SecondaryButton>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Keyboard: ← / → move between questions, 1–9 select an option, M marks for review, C
            clears the answer.
          </p>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Questions
          </h2>
          <QuestionPalette states={engine.paletteStates} onJump={goTo} />
        </aside>
      </div>

      <SubmitReviewDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        total={questions.length}
        answered={engine.answeredCount}
        unanswered={engine.unansweredCount}
        marked={engine.markedCount}
        submitting={engine.submitting}
        onConfirm={() => void finish(false)}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this attempt?"
        description="The attempt is discarded without being scored and will not appear as a completed result. This cannot be undone."
        confirmLabel="Cancel attempt"
        onConfirm={() => void abandon()}
      />

      <Modal
        open={engine.conflicts.length > 0}
        onOpenChange={(next) => {
          if (!next) engine.resolveConflicts("local");
        }}
        title="This attempt was also answered elsewhere"
        description={`${engine.conflicts.length} question${
          engine.conflicts.length === 1 ? " was" : "s were"
        } answered differently on another device or tab. Choose which answers to keep.`}
      >
        <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
          {engine.conflicts.map((conflict) => {
            const position = questions.findIndex((q) => q.question_id === conflict.questionId);
            return (
              <li key={conflict.questionId}>
                Question {position >= 0 ? position + 1 : "?"}: this device selected{" "}
                {conflict.localSelected.length} option
                {conflict.localSelected.length === 1 ? "" : "s"}, the other device selected{" "}
                {conflict.remoteSelected.length}.
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <PrimaryButton onClick={() => engine.resolveConflicts("local")}>
            Keep this device's answers
          </PrimaryButton>
          <SecondaryButton onClick={() => engine.resolveConflicts("remote")}>
            Use the other device's answers
          </SecondaryButton>
        </div>
      </Modal>
    </div>
  );
}
