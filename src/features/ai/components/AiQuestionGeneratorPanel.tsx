import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Sparkles, Trash2 } from "lucide-react";

import {
  CheckboxField,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  Spinner,
  StatusAlert,
  StatusBadge,
  SurfaceCard,
  TextField,
  notify,
} from "@/features/shared/components/ui";
import { Textarea } from "@/components/ui/textarea";
import {
  listCertifications,
  listDomains,
  listTopics,
} from "@/features/admin/services/taxonomy-service";
import { createAiDraftQuestion } from "@/features/admin/services/question-service";
import { questionSchema } from "@/features/admin/validation/question-schemas";
import { QUESTION_TYPE_LABELS } from "@/features/admin/types/questions";
import { useAiFeatureEnabled } from "../hooks/use-ai-features";
import { generateQuestions } from "../services/generator.functions";
import type { GeneratedQuestionDraft } from "../types";
import { AiDisclaimer } from "./AiDisclaimer";

type Draft = GeneratedQuestionDraft & { saved?: boolean };

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

const DIFFICULTY_OPTIONS = [
  { value: "mixed", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const TYPE_OPTIONS = [
  { value: "mixed", label: "Mixed" },
  { value: "single_choice", label: QUESTION_TYPE_LABELS.single_choice },
  { value: "multiple_choice", label: QUESTION_TYPE_LABELS.multiple_choice },
  { value: "scenario_single_choice", label: QUESTION_TYPE_LABELS.scenario_single_choice },
  { value: "scenario_multiple_choice", label: QUESTION_TYPE_LABELS.scenario_multiple_choice },
];

/**
 * Admin AI Question Generator.
 *
 * Every draft is editable here and saved unpublished into the draft bank with
 * a review flag; nothing this panel does can publish a question. The feature
 * flag, admin role, rate limit, prompt sanitisation and audit trail are all
 * re-enforced server-side, so this UI is convenience, not control.
 */
export function AiQuestionGeneratorPanel() {
  const enabled = useAiFeatureEnabled("ai_question_generator");
  const run = useServerFn(generateQuestions);

  const certifications = useQuery({ queryKey: ["certifications"], queryFn: listCertifications });
  const domains = useQuery({ queryKey: ["domains"], queryFn: listDomains });
  const topics = useQuery({ queryKey: ["topics"], queryFn: listTopics });

  const [certificationId, setCertificationId] = React.useState("");
  const [domainId, setDomainId] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [count, setCount] = React.useState("3");
  const [difficulty, setDifficulty] = React.useState("mixed");
  const [questionType, setQuestionType] = React.useState("mixed");
  const [guidance, setGuidance] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [meta, setMeta] = React.useState<{ requestId: string; model: string } | null>(null);

  const domainOptions = (domains.data ?? [])
    .filter((row) => !certificationId || row.certification_id === certificationId)
    .map((row) => ({ value: row.id, label: row.name }));
  const topicOptions = (topics.data ?? [])
    .filter((row) => !domainId || row.domain_id === domainId)
    .map((row) => ({ value: row.id, label: row.name }));

  function patchDraft(key: string, patch: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)),
    );
  }

  async function onGenerate() {
    setError(null);
    if (!certificationId || !domainId || !topicId) {
      setError("Choose a certification, domain and topic first.");
      return;
    }
    setBusy(true);
    try {
      const result = await run({
        data: {
          certificationId,
          domainId,
          topicId,
          count: Number(count),
          difficulty: difficulty as "mixed",
          questionType: questionType as "mixed",
          ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
        },
      });
      setMeta({ requestId: result.requestId, model: result.model });
      setDrafts((current) => [...result.drafts, ...current]);
      if (result.sanitizedInput) {
        notify.info("Some guidance text was removed before it reached the model.");
      }
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDraft(draft: Draft) {
    setSavingKey(draft.key);
    try {
      const parsed = questionSchema.safeParse({
        certification_id: certificationId,
        domain_id: domainId,
        topic_id: topicId,
        question_type: draft.questionType,
        scenario: draft.scenario ?? "",
        stem: draft.stem,
        explanation: draft.explanation,
        difficulty: draft.difficulty,
        points: 1,
        is_active: false,
        options: draft.options.map((option) => ({
          content: option.content,
          is_correct: option.is_correct,
        })),
      });
      if (!parsed.success) {
        notify.error(parsed.error.issues[0]?.message ?? "Fix the draft before saving");
        return;
      }
      await createAiDraftQuestion(parsed.data, {
        requestId: meta?.requestId ?? "unknown",
        model: meta?.model ?? "unknown",
        duplicateCount: draft.duplicates.length,
      });
      patchDraft(draft.key, { saved: true });
      notify.success("Saved to the draft bank — unpublished and flagged for review");
    } catch (cause) {
      notify.error(cause instanceof Error ? cause.message : "Could not save the draft");
    } finally {
      setSavingKey(null);
    }
  }

  if (!enabled) {
    return (
      <EmptyState
        title="AI Question Generator is switched off"
        description="Enable the module under AskMe AI settings to draft questions."
      />
    );
  }

  return (
    <div className="space-y-6">
      <AiDisclaimer />

      <SurfaceCard>
        <h2 className="text-lg font-semibold">Generate drafts</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Drafts are never published. Each saved question lands in the draft bank as inactive and
          flagged for technical and language review.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SelectField
            id="gen-certification"
            label="Certification"
            value={certificationId}
            onValueChange={(value) => {
              setCertificationId(value);
              setDomainId("");
              setTopicId("");
            }}
            options={(certifications.data ?? []).map((row) => ({
              value: row.id,
              label: `${row.name} (${row.code})`,
            }))}
          />
          <SelectField
            id="gen-domain"
            label="Domain"
            value={domainId}
            onValueChange={(value) => {
              setDomainId(value);
              setTopicId("");
            }}
            options={domainOptions}
            disabled={!certificationId}
          />
          <SelectField
            id="gen-topic"
            label="Topic"
            value={topicId}
            onValueChange={setTopicId}
            options={topicOptions}
            disabled={!domainId}
          />
          <SelectField
            id="gen-difficulty"
            label="Difficulty"
            value={difficulty}
            onValueChange={setDifficulty}
            options={DIFFICULTY_OPTIONS}
          />
          <SelectField
            id="gen-type"
            label="Question type"
            value={questionType}
            onValueChange={setQuestionType}
            options={TYPE_OPTIONS}
          />
          <SelectField
            id="gen-count"
            label="How many"
            value={count}
            onValueChange={setCount}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} question(s)` }))}
          />
        </div>
        <div className="mt-4 space-y-2">
          <label htmlFor="gen-guidance" className="text-sm font-medium">
            Extra guidance (optional)
          </label>
          <Textarea
            id="gen-guidance"
            rows={2}
            maxLength={600}
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="e.g. focus on Conditional Access session controls for guest users"
          />
        </div>
        {error ? (
          <StatusAlert tone="error" title="Generation failed" className="mt-4">
            {error}
          </StatusAlert>
        ) : null}
        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton onClick={() => void onGenerate()} disabled={busy}>
            {busy ? <Spinner /> : <Sparkles className="size-4" aria-hidden="true" />}
            {busy ? "Drafting…" : "Generate drafts"}
          </PrimaryButton>
          {drafts.length > 0 ? (
            <SecondaryButton onClick={() => setDrafts([])} disabled={busy}>
              Clear list
            </SecondaryButton>
          ) : null}
        </div>
      </SurfaceCard>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          description="Choose a topic and generate a few questions to review."
        />
      ) : (
        <ul className="space-y-6">
          {drafts.map((draft) => (
            <li key={draft.key}>
              <SurfaceCard>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="neutral">Draft — unpublished</StatusBadge>
                  <StatusBadge tone="info">AI-generated</StatusBadge>
                  {draft.saved ? (
                    <StatusBadge tone="success">Saved to draft bank</StatusBadge>
                  ) : null}
                  {draft.duplicates.length > 0 ? (
                    <StatusBadge tone="warning">
                      {draft.duplicates.length} possible duplicate(s)
                    </StatusBadge>
                  ) : null}
                </div>

                {draft.duplicates.length > 0 ? (
                  <StatusAlert tone="warning" title="Similar questions already exist" className="mt-4">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {draft.duplicates.map((duplicate) => (
                        <li key={duplicate.questionId}>
                          {Math.round(duplicate.similarity * 100)}% — {duplicate.stem.slice(0, 160)}
                        </li>
                      ))}
                    </ul>
                  </StatusAlert>
                ) : null}

                <div className="mt-4 grid gap-4">
                  {draft.scenario !== null ? (
                    <div className="space-y-2">
                      <label htmlFor={`${draft.key}-scenario`} className="text-sm font-medium">
                        Scenario
                      </label>
                      <Textarea
                        id={`${draft.key}-scenario`}
                        rows={3}
                        value={draft.scenario ?? ""}
                        onChange={(event) =>
                          patchDraft(draft.key, { scenario: event.target.value })
                        }
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label htmlFor={`${draft.key}-stem`} className="text-sm font-medium">
                      Question
                    </label>
                    <Textarea
                      id={`${draft.key}-stem`}
                      rows={3}
                      value={draft.stem}
                      onChange={(event) => patchDraft(draft.key, { stem: event.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      id={`${draft.key}-type`}
                      label="Question type"
                      value={draft.questionType}
                      onValueChange={(value) => patchDraft(draft.key, { questionType: value })}
                      options={TYPE_OPTIONS.filter((option) => option.value !== "mixed")}
                    />
                    <SelectField
                      id={`${draft.key}-difficulty`}
                      label="Difficulty"
                      value={draft.difficulty}
                      onValueChange={(value) => patchDraft(draft.key, { difficulty: value })}
                      options={DIFFICULTY_OPTIONS.filter((option) => option.value !== "mixed")}
                    />
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">Answer options</legend>
                    {draft.options.map((option, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-1">
                          <TextField
                            id={`${draft.key}-option-${index}`}
                            label={`Option ${index + 1}`}
                            value={option.content}
                            onChange={(event) =>
                              patchDraft(draft.key, {
                                options: draft.options.map((current, position) =>
                                  position === index
                                    ? { ...current, content: event.target.value }
                                    : current,
                                ),
                              })
                            }
                          />
                        </div>
                        <div className="pt-8">
                          <CheckboxField
                            id={`${draft.key}-correct-${index}`}
                            label="Correct"
                            checked={option.is_correct}
                            onCheckedChange={(checked) =>
                              patchDraft(draft.key, {
                                options: draft.options.map((current, position) =>
                                  position === index
                                    ? { ...current, is_correct: checked }
                                    : current,
                                ),
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </fieldset>

                  <div className="space-y-2">
                    <label htmlFor={`${draft.key}-explanation`} className="text-sm font-medium">
                      Explanation
                    </label>
                    <Textarea
                      id={`${draft.key}-explanation`}
                      rows={4}
                      value={draft.explanation}
                      onChange={(event) =>
                        patchDraft(draft.key, { explanation: event.target.value })
                      }
                    />
                  </div>

                  {draft.tags.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Suggested tags: {draft.tags.join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PrimaryButton
                    onClick={() => void onSaveDraft(draft)}
                    disabled={savingKey === draft.key || draft.saved}
                  >
                    {savingKey === draft.key ? (
                      <Spinner />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    {draft.saved ? "Saved" : "Save to draft bank"}
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={() =>
                      setDrafts((current) => current.filter((row) => row.key !== draft.key))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Discard
                  </SecondaryButton>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Requires human technical and language review before publishing.
                  </span>
                </div>
              </SurfaceCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}