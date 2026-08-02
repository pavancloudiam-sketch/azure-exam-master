import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Flag, GraduationCap, Sparkles, TrendingDown } from "lucide-react";

import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
} from "@/features/shared/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { AI_CONVERSATION_LIMITS } from "../constants";
import { useAiFeatureEnabled } from "../hooks/use-ai-features";
import { STUDY_ACTION_LABELS, type StudyAction } from "../prompts/templates";
import { askStudyAssistant, getStudyOverview } from "../services/study.functions";
import { AiDisclaimer } from "./AiDisclaimer";
import { ReportAiContentDialog } from "./ReportAiContentDialog";

type Turn = { role: "user" | "assistant"; content: string; requestId?: string };

const QUICK_ACTIONS: StudyAction[] = [
  "review_mistakes",
  "weak_domains",
  "progress_report",
  "study_plan",
  "next_topics",
];


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

const accuracy = (correct: number, total: number) =>
  total === 0 ? "—" : `${Math.round((correct / total) * 100)}%`;

/**
 * Student Study Assistant.
 *
 * The browser sends an action key, optional study goals and the transcript.
 * Feature flag, live-attempt block, rate limit, sanitisation and audit logging
 * are all enforced again server-side, so this UI is convenience, not control.
 */
export function AiStudyAssistantPanel() {
  const enabled = useAiFeatureEnabled("ai_study_assistant");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");
  const [hoursPerWeek, setHoursPerWeek] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [reporting, setReporting] = React.useState<Turn | null>(null);

  const overview = useQuery({
    queryKey: ["ai", "study-overview"],
    queryFn: () => getStudyOverview(),
    enabled,
    staleTime: 60_000,
  });

  const limitReached = turns.length >= AI_CONVERSATION_LIMITS.maxTurns;

  async function run(action: StudyAction, userText?: string) {
    if (busy || limitReached) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const nextTurns: Turn[] = userText ? [...turns, { role: "user", content: userText }] : turns;
    if (userText) setTurns(nextTurns);

    const hours = Number.parseInt(hoursPerWeek, 10);
    const goal = {
      ...(targetDate ? { targetDate } : {}),
      ...(Number.isFinite(hours) && hours > 0 ? { hoursPerWeek: Math.min(hours, 60) } : {}),
    };

    try {
      const reply = await askStudyAssistant({
        data: {
          action,
          ...(Object.keys(goal).length > 0 ? { goal } : {}),
          messages: action === "ask" ? nextTurns.map(({ role, content }) => ({ role, content })) : [],
        },
      });
      if (reply.sanitizedInput) {
        setNotice(
          "Some of your message looked like an instruction to the assistant and was ignored. Your study question was still answered.",
        );
      }
      setTurns((current) => [
        ...current,
        { role: "assistant", content: reply.text, requestId: reply.requestId },
      ]);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <SurfaceCard>
        <EmptyState
          title="Study Assistant is not available yet"
          description="An administrator can switch on the AskMe AI Study Assistant from the AI settings page."
        />
      </SurfaceCard>
    );
  }

  const stats = overview.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <SurfaceCard>
        <div className="space-y-5">
          <header className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <GraduationCap aria-hidden className="size-5" /> AskMe AI Study Assistant
            </h2>
            <p className="text-muted-foreground text-sm">
              Ask about Microsoft Entra ID concepts, review your incorrect answers, and get a study
              plan built from your own submitted practice attempts.
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="study-target-date"
              label="Target exam date (optional)"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
            <TextField
              id="study-hours"
              label="Study hours per week (optional)"
              type="number"
              min={1}
              max={60}
              value={hoursPerWeek}
              onChange={(event) => setHoursPerWeek(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <SecondaryButton
                key={action}
                type="button"
                onClick={() => void run(action)}
                disabled={busy || limitReached}
              >
                {STUDY_ACTION_LABELS[action]}
              </SecondaryButton>
            ))}
          </div>

          {error ? (
            <StatusAlert tone="error" title="AskMe AI couldn't respond">
              {error}
            </StatusAlert>
          ) : null}
          {notice ? (
            <StatusAlert tone="warning" title="Part of your message was ignored">
              {notice}
            </StatusAlert>
          ) : null}

          <div className="space-y-4">
            {turns.length === 0 && !busy ? (
              <p className="text-muted-foreground text-sm">
                Pick a shortcut above or ask a study question to get started.
              </p>
            ) : null}
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
            <label htmlFor="study-input" className="text-sm font-medium">
              Ask a study question
            </label>
            <Textarea
              id="study-input"
              rows={3}
              value={input}
              maxLength={AI_CONVERSATION_LIMITS.maxUserMessageChars}
              disabled={busy || limitReached}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. When would I use a Conditional Access exclusion group instead of a policy scope?"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {limitReached
                  ? "This conversation has reached its limit. Reload the page to start a new one."
                  : `${turns.length}/${AI_CONVERSATION_LIMITS.maxTurns} messages used · study topics only`}
              </p>
              <PrimaryButton type="submit" disabled={busy || limitReached || !input.trim()}>
                Send
              </PrimaryButton>
            </div>
          </form>

          <AiDisclaimer />
        </div>
      </SurfaceCard>

      <aside className="space-y-6">
        <SurfaceCard>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <TrendingDown aria-hidden className="size-4" /> Your weak areas
            </h3>
            {overview.isLoading ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Spinner /> Loading your results…
              </p>
            ) : !stats || stats.submittedAttempts === 0 ? (
              <p className="text-muted-foreground text-sm">
                Submit a practice exam and this panel will personalise its advice to your results.
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="neutral">{stats.submittedAttempts} attempts</StatusBadge>
                  <StatusBadge tone="neutral">{stats.answeredQuestions} answers</StatusBadge>
                  {stats.averagePercentage !== null ? (
                    <StatusBadge tone="info">Avg {stats.averagePercentage}%</StatusBadge>
                  ) : null}
                </div>
                <ul className="space-y-2">
                  {stats.weakDomains.map((domain) => (
                    <li key={domain.domain} className="flex items-center justify-between gap-3">
                      <span>{domain.domain}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {accuracy(domain.correct, domain.total)}
                      </span>
                    </li>
                  ))}
                </ul>
                {stats.recentMistakes > 0 ? (
                  <SecondaryButton
                    type="button"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void run("review_mistakes")}
                  >
                    Explain my {stats.recentMistakes} recent mistakes
                  </SecondaryButton>
                ) : null}
              </div>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <BookOpenCheck aria-hidden className="size-4" /> Suggested next topics
            </h3>
            {stats && stats.suggestedTopics.length > 0 ? (
              <ul className="text-muted-foreground space-y-2 text-sm">
                {stats.suggestedTopics.map((topic) => (
                  <li key={`${topic.domain}-${topic.topic}`}>
                    <span className="text-foreground">{topic.topic}</span>
                    <span className="block text-xs">{topic.domain}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No untouched topics found yet — ask for a study plan to go deeper on what you have
                already practised.
              </p>
            )}
            <SecondaryButton
              type="button"
              className="w-full"
              disabled={busy}
              onClick={() => void run("next_topics")}
            >
              <Sparkles aria-hidden className="mr-1 size-4" /> Suggest what to study next
            </SecondaryButton>
          </div>
        </SurfaceCard>
      </aside>

      <ReportAiContentDialog
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        feature="ai_study_assistant"
        reportedText={reporting?.content ?? ""}
        {...(reporting?.requestId ? { requestId: reporting.requestId } : {})}
      />
    </div>
  );
}
