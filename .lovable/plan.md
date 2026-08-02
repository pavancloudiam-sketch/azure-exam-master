
# SC-300 Realistic Simulator — Implementation Plan

## What already exists (verified, will not be rebuilt)
- Auth, RLS, roles, audit logging, document library, import pipeline, AI modules.
- Exam engine: autosave queue, question palette, mark-for-review, submit dialog, server-authoritative timer (`get_attempt_time_remaining`), idempotent `submit_attempt`, answer keys never leave the server (`get_attempt_questions` omits `is_correct`/explanation).
- Results + review screens with domain breakdown.

## The core architectural gap
Today an attempt's question set is the **exam's static `exam_questions` list**. Every student on the same exam sees the same questions in the same order. The spec requires a per-attempt, blueprint-driven, randomized, non-repeating selection frozen at start. Almost every other requirement (pilot items, partial credit, case studies, exposure tracking, readiness checks) hangs off that change.

So Phase 1 is: introduce `attempt_questions` (per-attempt frozen set) and route every read/score path through it, keeping `exam_questions` working as a fallback so nothing existing breaks.

---

## Phase 1 — Blueprint data model + per-attempt selection
Migrations:
- `exam_blueprints` — name, certification version, duration, min/default/max question count, passing scaled score, scoring-model version, randomization flags, cooldown days, max repeats, pilot count, partial-credit policy, allowed types, case-study count, published flag.
- `exam_blueprint_domains` — domain, min %, max %, topic quotas, difficulty distribution.
- `attempt_questions` — attempt, question, position, option order, `is_pilot`, points snapshot, scoring method snapshot. This is the frozen set.
- `question_exposure` — per student/question: times presented, first/last presented, last attempt, last result.
- Extend `questions`: `scoring_method` (`all_or_nothing` | `partial_credit`), `is_pilot_eligible`, `case_study_id`, `source_page`.
- Extend `attempts`: `blueprint_id`, `scoring_model_version`, `available_points`, `earned_points`, `pilot_count`, `scored_count`, `blueprint_snapshot` jsonb.

Selection engine (`select_attempt_questions`, security definer, called inside `start_attempt`):
1. Resolve blueprint → total count.
2. Largest-remainder allocation across domains from min/max % ranges, hitting the exact total.
3. Eligible pool = active + approved + published + matching certification version + allowed type.
4. Rank: unseen first, then last-presented ascending, excluding anything seen within cooldown while pool allows; tie-break `random()`.
5. Insufficient pool → borrow from nearest permitted range, record the reason in the snapshot, never duplicate within an attempt.
6. Insert into `attempt_questions`, write `question_exposure`, audit-log the allocation.

Rewrite `get_attempt_questions`, `submit_attempt`, `get_attempt_result`, `get_attempt_review` to read `attempt_questions` (falling back to `exam_questions` for pre-existing attempts).

Seed the "Realistic SC-300 Mock Exam" blueprint: 50 questions, 100 min, pass 700, min 35 / max 60, official 20–25 / 25–30 / 20–25 / 20–25 domain ranges.

## Phase 2 — Versioned practice scoring
- `scoring_models` table; v1 formula `round(1 + earned/available × 999)`, threshold 700.
- Per-item scoring in `submit_attempt`: all-or-nothing by default; proportional partial credit only where `scoring_method = 'partial_credit'`; no negative marking; pilot items excluded from `available_points` but recorded.
- Persist model version, raw/available points, percentage, scaled score, pass/fail, pilot count on the attempt. Historical attempts keep their stored version — recomputation never happens.
- Disclaimer surfaced in instructions and results: "AskMeExam uses its own practice scoring model. It does not reproduce Microsoft's official scaled-score calculation."

## Phase 3 — Modes + instruction gate
- Modes: `realistic_mock`, `practice`, `domain_practice`, `revision`. Each maps to a blueprint variant; only `revision` may reuse previously-missed questions.
- New route `/exams/$examId/start`: overview, question count, duration, pass score, navigation/mark-review/autosave rules, case-study rules, submission rules, practice + independent-platform disclaimers, required checkbox acknowledgement, Start / Cancel. The timer starts only on confirm (the attempt row is created at that click).

## Phase 4 — Case studies (Phase A question types)
- `case_studies` table: overview, environment, business/technical/security requirements, constraints, exhibits jsonb; `questions.case_study_id` links items.
- Runner: split panel — case content pinned beside its questions, intra-section navigation, autosave unchanged, independent scoring per item.
- `allow_case_study_return` blueprint flag; when off, an explicit warning before leaving the section.
- Also finish Yes/No statement groups (`yes_no_group`) as a scored Phase A type.

## Phase 5 — Admin blueprint editor + readiness dashboard
- `/admin/blueprints` — full blueprint CRUD with every configurable field above.
- Readiness panel: approved/published counts by domain, topic, type, difficulty; missing explanations/metadata; duplicate flags; awaiting review; exposure risk; estimated number of non-repeating 50-question attempts (labelled a content-pool estimate).
- Publication is blocked when the bank cannot satisfy the blueprint; all blueprint create/edit/publish events audited.

## Phase 6 — Document→question traceability
Extend the existing pipeline rather than replacing it: record source document ID, page/section, extraction date, AI model, generating admin, review status, rights attestation on generated drafts; enforce Draft-only creation; report honestly when a scanned PDF yields no text.

## Phase 7 — Tests + verification
Vitest + SQL-level checks for the numbered acceptance list: allocation totals and ranges, no in-attempt duplicates, cooldown determinism, frozen set, timer-after-confirm, hidden answer keys, partial credit only when configured, pilot exclusion, client-score rejection, 700 threshold, historical score immutability, readiness blocking. Existing 133 tests, typecheck, and production build must stay green.

---

## Deferred (documented as incomplete, not faked)
Phase B interaction types — build list, drag-and-drop, ordering, matching, dropdown, hot-area. These need authoring UI, storage format, scoring and review rendering each; they stay disabled behind an allowed-types flag rather than shipping unscoreable imitations.

## Technical notes
All selection and scoring stay in security-definer Postgres functions; the browser never receives correct-option IDs, explanations, point values, or pilot status during an attempt. Client-supplied user ID, question IDs, points, deadline, or score continue to be ignored. Existing RLS policies and the attempt-security test suite are preserved.

## Suggested execution
Phases 1–2 in one pass (they are inseparable), then 3–4, then 5, then 6–7. I'll stop after each pass so you can verify.
