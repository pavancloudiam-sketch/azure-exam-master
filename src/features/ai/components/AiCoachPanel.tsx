import * as React from "react";
import { Flag, Sparkles } from "lucide-react";

import { getAttemptQuestions } from "@/features/attempts/services/attempt-service";
import {
  PrimaryButton,
  SecondaryButton,
  SelectField,
  Spinner,
  StatusAlert,
  SurfaceCard,
} from "@/features/shared/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { AI_CONVERSATION_LIMITS } from "../constants";
import { useAiFeatureEnabled } from "../hooks/use-ai-features";
import { COACH_ACTION_LABELS, type CoachAction } from "../prompts/templates";
import { askAiCoach } from "../services/coach.functions";
import { AiDisclaimer } from "./AiDisclaimer";
import { ReportAiContentDialog } from "./ReportAiContentDialog";

type Turn = {
  role: "user" | "assistant";
  content: string;
  requestId?: string;
};

const QUICK_ACTIONS: CoachAction[] = ["explain", "simplify", "real_world", "study_next", "mini_quiz"];

function readError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : "";
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed?.message) return parsed.message;
  } catch {
    /* not a structured AI error */
  }
  return "AskMe AI couldn't complete that request. Please try again.";
}

/**
 * Post-exam coach. Rendered only on a submitted attempt's result page; the
 * server independently re-verifies ownership and submitted status, so this UI
 * is convenience, not the control.
 */
export function AiCoachPanel({ attemptId }: { attemptId: string }) {
  const enabled = useAiFeatureEnabled("ai_coach");
  const [questions, setQuestions] = React.useState<{ id: string; label: string }[]>([]);
  const [questionId, setQuestionId] = React.useState<string | undefined>(undefined);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reporting, setReporting] = React.useState<Turn | null>(null);

  React.useEffect(() => {
    let active = true;
    getAttemptQuestions(attemptId)
      .then((rows) => {
        if (!active) return;
        const mapped = rows.map((row, index) => ({
          id: row.question_id,
          label: `Q${index + 1}. ${row.stem.slice(0, 70)}${row.stem.length > 70 ? "…" : ""}`,
        }));
        setQuestions(mapped);
        setQuestionId(mapped[0]?.id);
      })
      .catch(() => {
        /* the coach still works on attempt-level guidance */
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const limitReached = turns.length >= AI_CONVERSATION_LIMITS.maxTurns;

  async function run(action: CoachAction, userText?: string) {
    if (busy || limitReached) return;
    setBusy(true);
    setError(null);
    const nextTurns: Turn[] = userText
      ? [...turns, { role: "user" as const, content: userText }]
      : turns;
    if (userText) setTurns(nextTurns);

    try {
      const reply = await askAiCoach({
        data: {
          attemptId,
          action,
          ...(questionId ? { questionId } : {}),
          messages: action === "ask" ? nextTurns.map(({ role, content }) => ({ role, content })) : [],
        },
      });
      setTurns((current) => [
        ...(userText ? current : current),
        { role: "assistant", content: reply.text, requestId: reply.requestId },
      ]);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <SurfaceCard>
      <div className="space-y-5">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles aria-hidden className="size-5" /> AskMe AI Coach
          </h2>
          <p className="text-muted-foreground text-sm">
            Available because this attempt is submitted. Your score is final and the coach cannot
            change it.
          </p>
        </header>

        {questions.length > 0 ? (
          <SelectField
            id="coach-question"
            label="Question to discuss"
            value={questionId ?? ""}
            onValueChange={setQuestionId}
            options={questions.map((question) => ({ value: question.id, label: question.label }))}
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <SecondaryButton
              key={action}
              type="button"
              onClick={() => void run(action)}
              disabled={busy || limitReached}
            >
              {COACH_ACTION_LABELS[action]}
            </SecondaryButton>
          ))}
        </div>

        {error ? (
          <StatusAlert tone="error" title="AskMe AI couldn't respond">
            {error}
          </StatusAlert>
        ) : null}

        <div className="space-y-4">
          {turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={
                turn.role === "user"
                  ? "bg-surface rounded-lg border px-4 py-3 text-sm"
                  : "space-y-2 rounded-lg border px-4 py-3 text-sm"
              }
            >
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {turn.role === "user" ? "You" : "AskMe AI"}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
              {turn.role === "assistant" ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <AiDisclaimer variant="inline" />
                  <button
                    type="button"
                    onClick={() => setReporting(turn)}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline"
                  >
                    <Flag aria-hidden className="size-3" /> Report this response
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {busy ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner /> AskMe AI is thinking…
            </p>
          ) : null}
        </div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const text = input.trim();
            if (!text) return;
            setInput("");
            void run("ask", text);
          }}
        >
          <label htmlFor="coach-input" className="text-sm font-medium">
            Ask a follow-up
          </label>
          <Textarea
            id="coach-input"
            rows={3}
            value={input}
            maxLength={AI_CONVERSATION_LIMITS.maxUserMessageChars}
            disabled={busy || limitReached}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. Why is Conditional Access evaluated before this setting?"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              {limitReached
                ? "This conversation has reached its limit. Reload the page to start a new one."
                : `${turns.length}/${AI_CONVERSATION_LIMITS.maxTurns} messages used`}
            </p>
            <PrimaryButton type="submit" disabled={busy || limitReached || !input.trim()}>
              Send
            </PrimaryButton>
          </div>
        </form>

        <AiDisclaimer />
      </div>

      <ReportAiContentDialog
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        reportedText={reporting?.content ?? ""}
        attemptId={attemptId}
        {...(questionId ? { questionId } : {})}
        {...(reporting?.requestId ? { requestId: reporting.requestId } : {})}
      />
    </SurfaceCard>
  );
}