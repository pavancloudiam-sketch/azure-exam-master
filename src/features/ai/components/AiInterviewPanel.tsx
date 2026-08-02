import * as React from "react";
import { Flag, MessageSquare, Save, Trash2 } from "lucide-react";

import {
  PrimaryButton,
  SecondaryButton,
  DestructiveButton,
  SelectField,
  TextField,
  Spinner,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  notify,
} from "@/features/shared/components/ui";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_CONVERSATION_LIMITS,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_DIFFICULTY_LABELS,
  INTERVIEW_DISCLAIMER,
  INTERVIEW_LENGTHS,
  INTERVIEW_STYLES,
  INTERVIEW_STYLE_LABELS,
  INTERVIEW_TOPICS,
  type InterviewDifficulty,
  type InterviewStyle,
} from "../constants";
import { useAiFeatureEnabled } from "../hooks/use-ai-features";
import {
  deleteInterviewSession,
  getInterviewSession,
  listInterviewSessions,
  runInterviewTurn,
  saveInterviewSession,
} from "../services/interview.functions";
import type { AiInterviewSessionSummary } from "../types";
import { AiDisclaimer } from "./AiDisclaimer";
import { ReportAiContentDialog } from "./ReportAiContentDialog";

type Turn = { role: "user" | "assistant"; content: string; requestId?: string };

function readError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : "";
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed?.message) return parsed.message;
  } catch {
    /* not a structured AI error */
  }
  return raw || "AskMe AI couldn't complete that request. Please try again.";
}

/**
 * Mock-interview practice. Nothing is stored unless the student presses Save,
 * and the server re-checks the feature flag, rate limits and ownership.
 */
export function AiInterviewPanel() {
  const enabled = useAiFeatureEnabled("ai_interview_coach");

  const [topic, setTopic] = React.useState<string>(INTERVIEW_TOPICS[0]);
  const [difficulty, setDifficulty] = React.useState<InterviewDifficulty>("intermediate");
  const [style, setStyle] = React.useState<InterviewStyle>("mixed");
  const [plannedQuestions, setPlannedQuestions] = React.useState<number>(5);

  const [started, setStarted] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [answer, setAnswer] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reporting, setReporting] = React.useState<Turn | null>(null);
  const [saveTitle, setSaveTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [sessions, setSessions] = React.useState<AiInterviewSessionSummary[]>([]);

  const setup = { topic, difficulty, style, plannedQuestions };
  const asked = turns.filter((turn) => turn.role === "assistant").length;
  const limitReached = turns.length >= AI_CONVERSATION_LIMITS.maxTurns;

  const refreshSessions = React.useCallback(() => {
    listInterviewSessions()
      .then(setSessions)
      .catch(() => {
        /* saved history is optional */
      });
  }, []);

  React.useEffect(() => {
    if (enabled) refreshSessions();
  }, [enabled, refreshSessions]);

  async function advance(nextTurns: Turn[]) {
    setBusy(true);
    setError(null);
    try {
      const reply = await runInterviewTurn({
        data: {
          setup,
          messages: nextTurns.map(({ role, content }) => ({ role, content })),
        },
      });
      setTurns([
        ...nextTurns,
        { role: "assistant", content: reply.text, requestId: reply.requestId },
      ]);
      if (reply.isFinal) setFinished(true);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setStarted(true);
    setFinished(false);
    setTurns([]);
    await advance([]);
  }

  async function submitAnswer(text: string) {
    if (busy || finished || limitReached) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setAnswer("");
    await advance(next);
  }

  async function save(status: "in_progress" | "completed") {
    if (turns.length === 0) return;
    setSaving(true);
    try {
      await saveInterviewSession({
        data: {
          setup,
          status,
          ...(saveTitle.trim() ? { title: saveTitle.trim() } : {}),
          messages: turns.map(({ role, content }) => ({ role, content })),
        },
      });
      notify.success("Interview saved to your history.");
      setSaveTitle("");
      refreshSessions();
    } catch (cause) {
      notify.error(readError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function openSaved(id: string) {
    try {
      const detail = await getInterviewSession({ data: { id } });
      setTopic(detail.topic);
      setDifficulty(detail.difficulty as InterviewDifficulty);
      setStyle(detail.style as InterviewStyle);
      setPlannedQuestions(detail.plannedQuestions);
      setTurns(detail.turns);
      setStarted(true);
      setFinished(detail.status === "completed");
    } catch (cause) {
      notify.error(readError(cause));
    }
  }

  async function remove(id: string) {
    try {
      await deleteInterviewSession({ data: { id } });
      refreshSessions();
    } catch (cause) {
      notify.error(readError(cause));
    }
  }

  if (!enabled) {
    return (
      <StatusAlert tone="info" title="Interview Coach is not enabled">
        An administrator needs to switch on the AskMe AI Interview Coach before you can practise.
      </StatusAlert>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="space-y-5">
          <header className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquare aria-hidden className="size-5" /> Interview setup
            </h2>
            <p className="text-muted-foreground text-sm">{INTERVIEW_DISCLAIMER}</p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="interview-topic"
              label="Topic"
              value={topic}
              onValueChange={setTopic}
              disabled={started}
              options={INTERVIEW_TOPICS.map((value) => ({ value, label: value }))}
            />
            <SelectField
              id="interview-difficulty"
              label="Difficulty"
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as InterviewDifficulty)}
              disabled={started}
              options={INTERVIEW_DIFFICULTIES.map((value) => ({
                value,
                label: INTERVIEW_DIFFICULTY_LABELS[value],
              }))}
            />
            <SelectField
              id="interview-style"
              label="Question style"
              value={style}
              onValueChange={(value) => setStyle(value as InterviewStyle)}
              disabled={started}
              options={INTERVIEW_STYLES.map((value) => ({
                value,
                label: INTERVIEW_STYLE_LABELS[value],
              }))}
            />
            <SelectField
              id="interview-length"
              label="Interview length"
              value={String(plannedQuestions)}
              onValueChange={(value) => setPlannedQuestions(Number(value))}
              disabled={started}
              options={INTERVIEW_LENGTHS.map((value) => ({
                value: String(value),
                label: `${value} questions`,
              }))}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton type="button" onClick={() => void start()} disabled={busy}>
              {started ? "Restart interview" : "Start interview"}
            </PrimaryButton>
            {started ? (
              <SecondaryButton
                type="button"
                onClick={() => {
                  setStarted(false);
                  setFinished(false);
                  setTurns([]);
                  setAnswer("");
                  setError(null);
                }}
                disabled={busy}
              >
                End and clear
              </SecondaryButton>
            ) : null}
            {started ? (
              <StatusBadge tone="info">
                {Math.min(asked, plannedQuestions)}/{plannedQuestions} questions
              </StatusBadge>
            ) : null}
          </div>
        </div>
      </SurfaceCard>

      {started ? (
        <SurfaceCard>
          <div className="space-y-5">
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
                    {turn.role === "user" ? "Your answer" : "AskMe AI interviewer"}
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

            {finished ? (
              <StatusAlert tone="success" title="Interview complete">
                {INTERVIEW_DISCLAIMER}
              </StatusAlert>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = answer.trim();
                  if (!text) return;
                  void submitAnswer(text);
                }}
              >
                <label htmlFor="interview-answer" className="text-sm font-medium">
                  Your answer
                </label>
                <Textarea
                  id="interview-answer"
                  rows={5}
                  value={answer}
                  maxLength={AI_CONVERSATION_LIMITS.maxUserMessageChars}
                  disabled={busy || limitReached}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Answer as you would in a real interview…"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground text-xs">
                    {limitReached
                      ? "This interview has reached its length limit."
                      : `${turns.length}/${AI_CONVERSATION_LIMITS.maxTurns} messages used`}
                  </p>
                  <PrimaryButton type="submit" disabled={busy || limitReached || !answer.trim()}>
                    Submit answer
                  </PrimaryButton>
                </div>
              </form>
            )}

            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Save this interview (optional)</p>
              <p className="text-muted-foreground text-xs">
                Nothing is stored unless you save it. Saved interviews are visible only to you.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1">
                  <TextField
                    id="interview-title"
                    label="Title"
                    value={saveTitle}
                    onChange={(event) => setSaveTitle(event.target.value)}
                    placeholder={`${topic} interview`}
                  />
                </div>
                <SecondaryButton
                  type="button"
                  onClick={() => void save(finished ? "completed" : "in_progress")}
                  loading={saving}
                  disabled={turns.length === 0}
                >
                  <Save aria-hidden className="size-4" /> Save to my history
                </SecondaryButton>
              </div>
            </div>

            <AiDisclaimer />
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Saved interviews</h2>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You haven't saved any interviews yet.
            </p>
          ) : (
            <ul className="divide-y">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{session.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {session.topic} · {session.difficulty} · {session.questionsAsked} questions ·{" "}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <SecondaryButton type="button" onClick={() => void openSaved(session.id)}>
                      Open
                    </SecondaryButton>
                    <DestructiveButton type="button" onClick={() => void remove(session.id)}>
                      <Trash2 aria-hidden className="size-4" /> Delete
                    </DestructiveButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SurfaceCard>

      <ReportAiContentDialog
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        reportedText={reporting?.content ?? ""}
        feature="ai_interview_coach"
        {...(reporting?.requestId ? { requestId: reporting.requestId } : {})}
      />
    </div>
  );
}
