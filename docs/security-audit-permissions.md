# Security audit — permissions and data exposure (Prompt 14)

Date: 2026-08-01 · Scope: table/function grants, RLS behaviour under real
signed-in sessions, anonymous access, cross-student isolation, privilege
escalation, admin-only surfaces.

Method: live black-box testing. A second student account ("attacker B") and an
anonymous browser session were driven against the running app and the Data API
with the app's own publishable key — no service-role shortcuts.

## Result summary

| # | Check | Result |
|---|---|---|
| 1 | Anonymous access to `/dashboard`, `/exams`, `/admin*`, `/results/:id` | Redirected to `/auth` |
| 2 | Anonymous Data API reads on all 12 tables | 0 rows |
| 3 | Anonymous call to `get_attempt_result` | `permission denied for function` |
| 4 | Student loading admin routes | Redirected to `/dashboard` |
| 5 | Student reading another user's profile / all profiles | Own row only |
| 6 | Student reading another user's attempts / answers | 0 rows |
| 7 | Student calling `get_attempt_result` / `get_attempt_questions` for another user's attempt | 0 rows |
| 8 | Student writing an answer into another user's attempt | RLS violation |
| 9 | Student reading `question_options` directly (answer key) | 0 rows |
| 10 | Student reading `is_correct` via the options RPC | Column not returned |
| 11 | Student writing `attempts.status` / `score` / `expires_at` | `permission denied for table attempts` |
| 12 | Student inserting or updating their own role | RLS violation / 0 rows |
| 13 | Student writing questions, exams, certifications | 0 rows |
| 14 | Student reading or inserting audit logs | 0 rows / RLS violation |
| 15 | **Student reading `questions.explanation` during an active attempt** | **FAILED — fixed, see below** |

## Findings and fixes

### F1 — Answer rationale readable mid-exam (high)

`questions_read` grants a student SELECT on every question in an exam they
have an attempt on. RLS is row-level only, so the row it returned included
`explanation` — the written rationale for the correct answer — while the
attempt was still in progress. The exam UI never requested that column, but
any client using the publishable key could.

Fix: column-level SELECT on `public.questions` was revoked from
`authenticated` and re-granted for every column **except** `explanation`.
Explanations are now served by `get_question_explanations(uuid[])`, a
security-definer function that returns a row only when the caller is an admin
or has a **submitted** attempt containing that question. The admin question
bank reads through this function; the student exam runner never touches it.

### F2 — `anon` held `ALL` privileges on every public table (low, defence in depth)

Every `public` table carried the legacy blanket grant to `anon`. No policy
targets `anon`, so RLS already returned zero rows on all of them (verified in
check 2), but the grants were far wider than intended and one accidental
permissive policy would have exposed a table outright. All `anon` privileges
on the twelve application tables were revoked.

## Accepted by design

- Eight `SECURITY DEFINER` functions are executable by `authenticated`
  (`submit_attempt`, `cancel_attempt`, `get_attempt_result`,
  `get_attempt_questions`, `get_question_options`,
  `get_question_explanations`, `has_role`, `owns_attempt`). This is
  deliberate: they *are* the controlled access path, each re-checks
  `auth.uid()` ownership or `has_role(...)` internally, and each projects only
  safe columns. Making them invoker-rights would break the answer-key hiding
  they exist to provide. `EXECUTE` is withheld from `anon` and `PUBLIC`.
- Students can read `exam_questions` rows, but only for exams they hold an
  attempt on, and the rows contain no content — just ordering.
- `questions.stem`, `scenario` and `points` remain readable by a student with
  an attempt; that is the exam content they are being shown anyway.
