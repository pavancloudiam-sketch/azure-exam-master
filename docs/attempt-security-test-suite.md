# Attempt, Timer and Scoring Attack Suite

`tests/attempt-security.py` is the repeatable security suite for attempt
ownership, timer authority, autosave integrity, submission, scoring, result
access and review access. Every assertion is made against the database/API
boundary (PostgREST tables + RPC), never through the UI.

## Safety warnings

- Run only against a dedicated test environment. Never against production.
- The suite creates a throwaway exam titled `ZZ-TEST attempt-security <stamp>`
  and throwaway student accounts, then deletes the exam, which cascades its
  attempts and answers.
- Auth users cannot be deleted from the API; the `zz-test-student-*@askmeexam.test`
  accounts remain and should be purged periodically in the test project.
- Real student attempts are never read or modified.
- Never commit passwords, tokens or keys. All credentials come from env vars.

## Required environment variables (names only)

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | project API base url |
| `SUPABASE_ANON_KEY` | publishable key |
| `TEST_ADMIN_EMAIL` | existing admin test account |
| `TEST_ADMIN_PASSWORD` | password for that account |
| `TEST_EXAM_ID` (optional) | published exam used as the question source |
| `SKIP_EXPIRY=1` (optional) | skip the ~75s wall-clock deadline scenarios |

## Required test users

- **Student A** — created by the suite at run time (signup).
- **Student B** — created by the suite at run time (signup).
- **Admin test user** — must already exist and hold the `admin` role. The role
  can only be granted through the database-controlled process in
  `docs/seed-admin.md`; the suite never escalates privileges.

## Test data

Created at the start of each run:

- One `ZZ-TEST` exam (published, 1-minute time limit, timed + practice enabled)
  in the same certification as the source exam.
- Four question links copied from the source exam (`exam_questions`).
- The answer key is read with the admin token and used to verify server scoring
  independently.

Cleanup runs in a `finally` block: the exam rows are deleted, cascading its
attempts and answers. On failure the suite prints a `FAILURE EVIDENCE` JSON
block (status codes, stored rows) before cleanup and exits non-zero.

## Running

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... \
python3 tests/attempt-security.py
```

Expected outcome: `32/32 checks passed`, exit code 0. Any `FAIL` line is a
confirmed regression: read the bracketed detail (HTTP status, error code,
stored rows) and compare against the state table below before changing code.

## Scenario results (last run)

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Anonymous start | PASS - `42501 permission denied for function start_attempt` |
| 2 | Student starts for themselves | PASS - owner is `auth.uid()` |
| 3 | Start with a supplied user id / direct insert | PASS - RPC 404, insert 403 |
| 4 | Second active attempt, same exam+mode | PASS - existing attempt returned |
| 5 | Read another student's attempt | PASS - 0 rows |
| 6 | Read another student's answers | PASS - 0 rows |
| 7 | Modify another student's answer | PASS - 403 / 0 rows, stored answer unchanged |
| 8 | Answer a question not in the exam | PASS - `Question is not part of this exam` |
| 9 | Direct edit of attempt/exam wiring | PASS - 403, row byte-identical |
| 10 | Forged deadline / clock manipulation | PASS - 403, remaining time unchanged |
| 11 | Answer after the server deadline | PASS - 403, stored answers unchanged |
| 12 | Submit after the deadline | PASS - scored, `duration_seconds` clamped to the limit |
| 13 | Double submit (sequential and concurrent) | PASS - idempotent, no rescore |
| 14 | Client-supplied correctness / score / timestamp | PASS - ignored, server recomputes |
| 15 | Option id from another question | PASS - `Selected option does not belong to this question` |
| 16 | Review an in-progress attempt | PASS - 0 rows |
| 17 | Result before submission | PASS - 0 rows |
| 18 | Resume a submitted / cancelled attempt | PASS - 403 |
| 19 | Replay autosave after submission / expiry | PASS - 403, answers unchanged |

Optional checks also passing: multiple-choice exact match, no partial credit,
unanswered scoring, empty-answer clearing, mark-for-review persistence,
duplicate autosave idempotency, invalid UUIDs, malformed option arrays,
unknown attempt ids.

## Attempt state transitions

`not_started` is not a stored value: it means no attempt row exists. Stored
statuses are constrained by `attempts_status_check` to
`in_progress | submitted | expired | cancelled`. State is never inferred from
timestamps or answer presence.

| From | To | Trigger | Who | Preconditions | Answers writable | Result visible | Review visible |
| --- | --- | --- | --- | --- | --- | --- | --- |
| not_started | in_progress | `start_attempt` | signed-in owner | exam available, mode enabled, certification accepting attempts | yes | no | no |
| in_progress | in_progress | autosave upsert | owner | not past `expires_at` (10s latency grace) | yes | no | no |
| in_progress | submitted | `submit_attempt` | owner | attempt found and still in progress | no | yes | yes |
| in_progress | cancelled | `cancel_attempt` | owner | deadline not passed | no | no | no |
| in_progress (past deadline) | submitted | `submit_attempt` | owner | any time after expiry; elapsed clamped to the limit | no | yes | yes |
| submitted / cancelled / expired | (unchanged) | any call | anyone | terminal; `submit_attempt` and `cancel_attempt` return the row as-is | no | submitted only | submitted only |

Direct `INSERT`, `UPDATE` and `DELETE` on `attempts` are not granted to
`anon` or `authenticated`, so every transition must pass through a routine.

## Scoring security

- **Where it runs:** entirely inside `submit_attempt` (SECURITY DEFINER), in a
  single transaction that locks the attempt row `FOR UPDATE`.
- **Answer key access:** `question_options.is_correct` is never selected by any
  student-reachable read path; the key is only joined inside the definer
  routines (`submit_attempt`, `get_attempt_result`, `get_attempt_review`), and
  review data is released only for submitted attempts.
- **Single choice:** the stored selection must equal the single correct option.
- **Multiple choice:** exact set match — the sorted distinct selection must
  equal the sorted set of correct options. No partial credit.
- **Unanswered:** empty selection scores zero; missing answer rows count toward
  `max_score` through the `exam_questions` join.
- **Point values:** taken from `questions.points` server-side; students have no
  write access to `questions`.
- **Client-supplied correctness:** the `attempt_answers` validation trigger
  forces `is_correct` to NULL and `answered_at` to `now()` on every browser
  write. Only the scoring routine may set `is_correct`, via a transaction-local
  flag the Data API cannot set.
- **Duplicate scoring:** `submit_attempt` returns the stored row unchanged when
  the status is not `in_progress`; row-level locking serialises concurrent
  submissions so the second caller sees the terminal state.
- **Scaled score:** `round(raw / max * 1000)`, pass at the exam's
  `passing_score` (default 700). It is an AskMeExam practice score only and is
  not a Microsoft score or a predictor of the real exam outcome.
- **Historical integrity:** scores are stored on the attempt row, attempts stay
  bound to the certification version they were taken against, and content is
  soft-deleted (`is_active` / `is_archived`) rather than removed, so past
  results and reviews keep rendering.

## Remaining risks

- Expired attempts keep the status `in_progress` until someone calls
  `submit_attempt`; answers are already blocked, but a background sweep to the
  `expired` status is still a follow-up.
- Auth test accounts accumulate in the test project.
- Rate limiting on autosave and submit is not covered by this suite.
