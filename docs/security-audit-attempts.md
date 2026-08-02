# Security Audit — Attempts, Timer and Scoring (Prompt 15)

Scope: attempt creation, ownership, status transitions, autosave, resume,
timer enforcement, submission, scoring, results and review. No features were
added; every change below closes an attack path.

Verification: `/tmp/browser/audit/attack15.py` signs up a real student, takes
its access token and drives the Data API directly (bypassing the UI), plus
`timer15.py` for clock tampering. Results are quoted per attack below.

## Vulnerabilities found

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| V1 | Clients created `attempts` rows directly and supplied their own `expires_at`, so a timed attempt could be given unlimited time. | High | Fixed |
| V2 | Clients also supplied `exam_id` and `mode` on that insert — an attempt could be opened against an **unpublished** exam, or a "timed" attempt created with no deadline at all. | Medium | Fixed |
| V3 | Autosave accepted answers after the deadline: `owns_attempt(_, true)` checked only `status = 'in_progress'`, never `expires_at`. Enforcement of the clock was entirely client-side. | High | Fixed |
| V4 | Autosave accepted a `question_id` that is not assigned to the attempt's exam, letting a student write answer rows for arbitrary questions. | Medium | Fixed |
| V5 | The countdown read the local device clock, so moving the system clock backwards extended the visible timer. | Medium | Fixed |
| V6 | `cancel_attempt` worked on an attempt whose time had already run out — a student heading for a fail could discard it instead of being scored. | Medium | Fixed |
| V7 | `duration_seconds` was raw wall-clock elapsed time; a resumed timed attempt could record a duration longer than the exam's own limit. | Low | Fixed |
| V8 | `get_question_explanations` released explanations for a question as soon as *any* attempt was submitted — including while a **retake of the same exam was still in progress**. | Medium | Fixed |
| V9 | `answered_at` was client-supplied and could be backdated. | Low | Fixed |

## Fixes made

- **`start_attempt(_exam_id, _mode)`** (security definer) is now the only way to
  create an attempt. It requires a session, validates the mode against
  `('timed','practice')`, requires the exam to be published (admins excepted),
  refuses timed mode on an exam with no configured limit, stamps `started_at`
  from the server clock and derives `expires_at` as `now() + time_limit`. It
  returns the existing live attempt instead of stacking duplicates.
  `INSERT` on `public.attempts` was revoked from `authenticated` and the
  `attempts_insert_own` policy dropped.
- **`owns_attempt(_, true)`** now also requires `expires_at IS NULL OR
  expires_at > now() - 10s`. The 10-second allowance absorbs network latency
  only; it is measured on the server, so the device clock cannot widen it.
  Every autosave policy on `attempt_answers` inherits this.
- **`check_answer_question` trigger** on `attempt_answers` rejects any
  `question_id` not joined to the attempt's exam through `exam_questions`, and
  overwrites `answered_at` with the server time. `EXECUTE` is withheld from
  `anon`, `authenticated` and `PUBLIC`.
- **`get_attempt_time_remaining(_attempt_id)`** returns the seconds left from
  the server clock for the caller's own attempt. `ExamTimer` anchors on this
  value, re-syncs every 30 s and ticks in between using the monotonic
  `performance.now()` clock instead of `Date.now()`.
- **`cancel_attempt`** raises once `expires_at` has passed; the attempt must be
  submitted and scored.
- **`submit_attempt`** clamps `duration_seconds` to `time_limit_minutes * 60`
  for timed attempts.
- **`get_question_explanations`** additionally requires that the caller has *no*
  in-progress attempt containing the question.

## Attempt-state transition table

| From | To | Trigger | Guarantees |
|------|----|---------|------------|
| — | `in_progress` | `start_attempt` | Session required; exam published; mode valid; `started_at`/`expires_at` server-set; existing live attempt reused |
| `in_progress` | `in_progress` | autosave | Owner only; before deadline; question must belong to the exam |
| `in_progress` | `submitted` | `submit_attempt` (manual or timer) | Owner only; row-locked `FOR UPDATE`; scores, `submitted_at`, `duration_seconds`, `passed` written in the same transaction |
| `in_progress` | `cancelled` | `cancel_attempt` | Owner only; **only before** the deadline; never scored, never a result |
| `submitted` | `submitted` | repeat `submit_attempt` | Returns the stored row unchanged — no re-scoring |
| `submitted` / `cancelled` | anything | — | Impossible: no `UPDATE` grant on `attempts` for `authenticated`, and both routines short-circuit |

No client path can set `status`, `score`, `scaled_score`, `passed`,
`expires_at`, `submitted_at` or `is_correct` — `UPDATE` on `attempts` and
`attempt_answers` score columns is not granted at all.

## Timer-validation design

1. `expires_at` is written once, by the server, at attempt creation.
2. The displayed countdown is presentation only. It is seeded from
   `get_attempt_time_remaining` (server clock), re-synced every 30 seconds, and
   ticks with `performance.now()`, which a user cannot move.
3. Enforcement does not depend on the countdown: once `expires_at` passes, the
   database refuses every answer write for that attempt.
4. Reaching zero calls the same `submit_attempt` routine as the manual button.
   Resuming an already-expired attempt re-syncs to `0` and auto-submits.
5. Verified: moving the browser clock forward one hour left the countdown
   running normally (`29:59` → `29:55`).

## Scoring-security design

- Grading happens only inside `submit_attempt` (security definer, single
  transaction, `FOR UPDATE` on the attempt row).
- Correctness is computed by comparing the stored `question_options.is_correct`
  set with the student's selected set — exact set match, no partial marks.
- Point values come from `questions.points` server-side; students hold no write
  grant on `questions` (a `PATCH` attempt changed nothing).
- The client never transmits a score, `is_correct`, percentage or pass flag.
- Results come from `get_attempt_result`, which returns rows only for
  **submitted** attempts owned by the caller (or an admin), and returns
  aggregates rather than the answer key.

## Attack results

| Attack | Result |
|--------|--------|
| 1. Changing the browser clock | Countdown unaffected; server-enforced deadline |
| 2. Editing local storage | Only holds the session token; all state re-read server-side |
| 3. Sending a late answer | `403` — RLS rejects writes past the deadline / after submission |
| 4. Submitting twice | Second call returns the identical stored row; no re-score |
| 5. Changing attempt status directly | `403 permission denied for table attempts` |
| 6. Changing exam ID / forging `expires_at` | `403` on insert; `start_attempt` owns both values |
| 7. Answer for an unassigned question | `400 Question is not part of this exam` |
| 8. Manipulating point values | `PATCH` matched no rows; `points` unchanged in the database |
| 9. Submitting a client-calculated score | `403 permission denied` on both `attempts` and `attempt_answers.is_correct` |
| 10. Reviewing an active attempt | `get_attempt_result` and `get_question_explanations` both return `[]` |
| 11. Resuming a submitted / expired attempt | Submitted attempt is read-only and cannot be cancelled; expired attempt auto-submits |
| 12. Replaying an autosave request | Replay after the deadline is rejected; before it, the upsert is idempotent per question |

## Remaining risks

- **Practice mode is untimed by design**, so a practice attempt can stay open
  indefinitely. Accepted for Phase 1.
- **A timed attempt left open is not auto-submitted in the background.** It
  simply stops accepting answers; scoring happens when the student next opens
  it. A scheduled sweep would close this presentation gap.
- **The 10-second latency grace** on answer writes lets a very fast client save
  one answer just after the deadline. Deliberate trade-off against dropping
  legitimate in-flight saves.
- **Screen capture and memorisation of questions** is outside the platform's
  control.
- **Admins can read every attempt and answer key.** Intentional; every admin
  mutation is written to `audit_logs`.
