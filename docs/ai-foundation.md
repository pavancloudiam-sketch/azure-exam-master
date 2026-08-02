# AskMe AI — foundation and safety (Phase 3, Prompt 27)

AskMe AI is a **separate service boundary** from the exam engine. No AI code
reads, writes, or influences scoring, attempt state, or stored results.

## Layout

| Path | Responsibility |
| --- | --- |
| `src/lib/ai-gateway.server.ts` | Provider construction. Server-only; reads `LOVABLE_API_KEY` inside the handler. |
| `src/features/ai/constants.ts` | Feature keys, rate limits, conversation limits, disclaimer text, model id. |
| `src/features/ai/prompts/templates.ts` | Global safety rules + per-module instruction blocks. |
| `src/features/ai/validation/schemas.ts` | Zod validation for every AI request payload. |
| `src/features/ai/services/ai-guards.server.ts` | Feature flags, access rules, rate protection, usage logging. |
| `src/features/ai/services/ai-service.server.ts` | The only place a model provider is called. |
| `src/features/ai/services/ai.functions.ts` | Authenticated server functions (flags, usage). |
| `src/features/ai/components/AiDisclaimer.tsx` | Required disclaimer surface. |

## Provider configuration

The model is reached through the Lovable AI Gateway using `LOVABLE_API_KEY`,
read from server environment only. The key is never referenced in browser code,
never exposed through `VITE_*`, and never returned to a client.

## Global AI rules (enforced in `AI_GLOBAL_RULES` and by server guards)

1. Never reveal correct answers during an active attempt —
   `assertNoActiveAttempt` and `assertSubmittedAttemptOwnedBy` block it before a
   prompt is built.
2. Never retrieve explanations for an active attempt — attempt-scoped AI
   requires `status = 'submitted'`; stored explanations remain gated by the
   existing `get_question_explanations` function.
3. AI access to attempt data requires authenticated ownership — reads go
   through the caller's own RLS-scoped client, so the database enforces it.
4. Original educational explanations only; no reproduction of leaked or
   proprietary exam questions.
5. AskMe AI is never presented as an official Microsoft source.
6. AI-generated questions are never auto-published (enforced when the admin
   generator ships in Prompt 31; the flag is off by default).
7. Minimal data to the provider: prompts carry question/topic content and
   opaque ids only — no email, name, or account identifiers.

## Rate protection

Per-user, per-feature hourly and daily budgets in `AI_RATE_LIMITS`, counted
against `ai_usage_logs` server-side. Conversation length and message size are
capped by `AI_CONVERSATION_LIMITS`.

## Usage logging

`ai_usage_logs` stores feature, model, status, error code, token counts,
latency, request id, and optional attempt id. **Prompt and completion text are
never stored.** Students read only their own rows; admins read all.

## Feature flags

`ai_feature_flags` holds one row per module, all disabled by default. Admins
toggle them at `/admin/ai`. Flags are checked server-side on every request —
hiding UI is a convenience, not the control.

## Error handling

`AiError` carries a stable code (`ai_disabled`, `ai_forbidden`,
`ai_rate_limited`, `ai_invalid_request`, `ai_unavailable`,
`ai_quota_exhausted`). Provider errors are logged server-side with a request id
and surfaced to users as plain guidance, never as raw provider text.

## Modules that were folded in or dropped

**AI Performance Coach — removed.** It never had a server function, context
builder or UI; only a disabled flag, a rate-limit entry and a prompt template.
Everything it described (per-domain accuracy, weak areas, a learning sequence,
small-sample honesty) is already produced by the Study Assistant from the same
`buildStudyContext` data. Keeping it would have meant a second module reading
identical data behind a second budget and a second admin switch. Its one unique
angle — score trend across submitted attempts — is now the Study Assistant
`progress_report` action, fed by `StudyContext.attemptTrend`. The
`ai_performance_coach` flag row, feature key and rate-limit entry are gone.


## Module: AskMe AI Coach (Prompt 28)

| Path | Responsibility |
| --- | --- |
| `src/features/ai/services/coach.functions.ts` | `askAiCoach`, `reportAiContent` server functions. |
| `src/features/ai/services/coach-context.server.ts` | Builds the authoritative prompt context for one submitted attempt. |
| `src/features/ai/components/AiCoachPanel.tsx` | Coach UI on `/results/$attemptId`. |
| `src/features/ai/components/ReportAiContentDialog.tsx` | Report unsafe or inaccurate output. |

Server-side chain on every coach request, in order: feature flag →
admin-only check → no attempt in progress → attempt is **submitted and owned**
(read through the caller's RLS-scoped client) → rate limit. Only after those
pass does the privileged client read the answer key, and only for that one
attempt. A `questionId` must belong to the attempt's exam, so the coach cannot
be pointed at an arbitrary question, and no other student's data is ever read.

Actions: `explain`, `simplify`, `real_world`, `study_next`, `mini_quiz`, `ask`.
The browser sends an action key and ids — never prompt or system text. The
`explain` action emits a dedicated "Stored explanation" section quoting the
platform text verbatim, keeping it distinct from AI supplementary guidance.

Conversation limits reuse `AI_CONVERSATION_LIMITS`. Failures are returned as
structured AI error codes and rendered as plain guidance; provider text is
never surfaced. Reports land in `ai_content_reports` (own rows for students,
all rows for admins) and never touch scoring.
## Module: AI Interview Coach (Prompt 30)

| Path | Responsibility |
| --- | --- |
| `src/features/ai/services/interview.functions.ts` | `runInterviewTurn`, `saveInterviewSession`, `listInterviewSessions`, `getInterviewSession`, `deleteInterviewSession`. |
| `src/features/ai/prompts/templates.ts` | `buildInterviewInstructions` — interviewer behaviour per difficulty, topic, length and style. |
| `src/features/ai/components/AiInterviewPanel.tsx` | Setup, turn-by-turn interview, optional save, saved history. |
| `/interview` | Authenticated student route. |

The student selects topic, difficulty (beginner / intermediate / advanced),
question style (conceptual, scenario-based, troubleshooting, mixed mock
interview) and length. The browser sends only that setup plus the transcript —
never prompt or system text. Each answer returns Feedback, Missing concepts, a
Suggested improved answer and one Next question; the final turn returns an
interview summary instead of another question.

Guards on every turn: feature flag → caller allowed → no attempt in progress →
rate limit (`ai_interview_coach` budget) → conversation length. Questions are
original by instruction; certification question banks are never read by this
module and no scoring or attempt state is touched.

**History is opt-in.** Nothing is persisted unless the student presses Save.
`ai_interview_sessions` and `ai_interview_turns` are written through the
caller's RLS-scoped client, readable and deletable only by their owner (admins
have read-only visibility for moderation). Every surface carries
`INTERVIEW_DISCLAIMER`: practice only, never a real employer's hiring decision
and never a Microsoft endorsement.
