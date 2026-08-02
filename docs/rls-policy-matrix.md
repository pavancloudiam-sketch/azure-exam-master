# AskMeExam — RLS Policy Matrix

Every table in `public` has RLS enabled. All policies target the `authenticated`
role only; `anon` has no grants on any table, so anonymous clients read nothing.
Role checks use the security-definer helper `has_role(auth.uid(), 'admin')`, and
attempt ownership uses `owns_attempt(attempt_id, require_active)`, where "active" means
`in_progress` **and** not past `expires_at` (server clock). Attempt creation, timing,
submission, cancellation and results all run through security-definer routines:
`start_attempt`, `get_attempt_time_remaining`, `submit_attempt`, `cancel_attempt`,
`get_attempt_result`. See `docs/security-audit-attempts.md`.

| Table | Student | Admin |
| --- | --- | --- |
| `profiles` | SELECT own (`id = auth.uid()`), UPDATE own | SELECT all |
| `user_roles` | SELECT own only. No INSERT/UPDATE/DELETE — self-promotion is impossible | Full manage (ALL) |
| `certifications` | SELECT where `is_active` | SELECT, INSERT, UPDATE (no DELETE — deactivate only) |
| `domains` | SELECT where the domain and its certification are active | SELECT, INSERT, UPDATE (no DELETE — deactivate only) |
| `topics` | SELECT where the topic, its domain and its certification are active | SELECT, INSERT, UPDATE (no DELETE — deactivate only) |
| `audit_logs` | No access | SELECT all; INSERT only with `actor_id = auth.uid()` |
| `questions` | SELECT only for questions in an exam the student has attempted (via `exam_questions`); correct answers never exposed | SELECT, INSERT, UPDATE (no DELETE — deactivate only) |
| `question_options` | No direct access — read through `get_question_options()`, which omits `is_correct` | Full manage |
| `exam_questions` | SELECT only for exams the student has attempted | Full manage (removal affects future deliveries only) |
| `attempts` | SELECT own rows only. No INSERT (use `start_attempt`), no UPDATE, no DELETE | SELECT all |
| `attempt_answers` | SELECT own; INSERT/UPDATE only while the owning attempt is `in_progress` **and before `expires_at`**, and only for questions assigned to that exam; no DELETE | SELECT all |

Active-session reads go through `get_attempt_questions(_attempt_id)`, a security-definer
function scoped to `a.user_id = auth.uid()` that returns only stem, scenario, type, points
and option `id/label/content/sort_order` — never `is_correct` and never the explanation.
| `exams` | SELECT where `is_published` | ALL |
| `questions` | SELECT only for exams the student has an attempt on | ALL |
| `question_options` | No direct access. Read via `get_question_options()`, which omits `is_correct` while an attempt is active | ALL |
| `attempts` | SELECT own only; creation goes through `start_attempt()`. No INSERT/UPDATE/DELETE grant | SELECT all |
| `attempt_answers` | SELECT own attempts; INSERT/UPDATE only while the parent attempt is active and unexpired, enforced by `owns_attempt()` plus the `check_answer_question` trigger. No DELETE | SELECT all |

## Role assignment

- `handle_new_user` (trigger on `auth.users`) creates the profile and inserts the
  `student` role. It is `SECURITY DEFINER`, so it bypasses the write-blocking policy.
- `admin` can only be granted by an existing admin (policy `user_roles_admin_manage`)
  or by a privileged server-side/database operation. The browser never sees the
  service-role key.

## Verification (2026-08-01)

| # | Test | Result |
| --- | --- | --- |
| 1 | Anonymous → `/dashboard` | Redirected to `/auth?redirect=%2Fdashboard` |
| 2 | Anonymous → `/admin` | Redirected to `/auth?redirect=%2Fadmin` |
| 3 | Student → `/admin` | Redirected to `/dashboard` |
| 4 | Student reads another student's attempt / answers | Returns `[]` (rows filtered by RLS) |
| 5 | Student inserts `user_roles` row with `role = 'admin'` | `new row violates row-level security policy`; UPDATE affects 0 rows |
| 6 | Student inserts a question | `new row violates row-level security policy` |
| 7 | Admin → `/admin`, insert certification, read all attempts | Allowed |
## Update — 2026-08-01 (permissions audit)

- `questions.explanation` is **not** selectable by `authenticated`. Column-level
  SELECT covers every other column. Explanations come from
  `get_question_explanations(uuid[])`: admins always, students only for questions
  in an attempt they have **submitted**.
- `anon` has no privileges on any application table (previously `ALL`, blocked by
  RLS but redundant).
- Full audit results: `docs/security-audit-permissions.md`.

## Update — 2026-08-02 (platform settings, Prompt 5 recovery)

`public.application_settings` is a **singleton** table: the primary key is a text
`id` fixed to `'global'` by a CHECK constraint, so conflicting settings rows cannot
exist. The design was chosen over a key/value table because the setting list is
small, fixed and strongly typed — each value gets its own column CHECK constraint
(email format, semantic version, score 1–1000, duration 1–600 minutes).

| Table | `anon` | `authenticated` (student) | `admin` |
| --- | --- | --- | --- |
| `application_settings` | SELECT (public branding only; contains no secrets) | SELECT | SELECT + UPDATE |

- Grants: `SELECT` to `anon`, `SELECT, UPDATE` to `authenticated`, `ALL` to `service_role`.
- Policies: `application_settings_select_public` (SELECT, `anon`+`authenticated`, `true`)
  and `application_settings_update_admin` (UPDATE, `authenticated`,
  `has_role(auth.uid(), 'admin')` in both USING and WITH CHECK).
- There is **no** INSERT or DELETE policy, so the row cannot be added or removed via the API.
- The table stores branding, support email, version and exam defaults only. No API keys,
  payment credentials or AI provider secrets are stored here.
- Trigger `application_settings_audit` (SECURITY DEFINER, `search_path = public`) forces
  `id`, `updated_at` and `updated_by`, and writes an `audit_logs` row with only the names
  and new values of the changed fields (the disclaimer body is recorded as a change flag).

### Admin role assignment routines

`grant_admin_role(text)` and `revoke_admin_role(text)` are SECURITY DEFINER with
`search_path = public`. `EXECUTE` is revoked from `PUBLIC`, `anon` and `authenticated`
and granted to `service_role` only; they are runnable by the project owner from SQL and
are unreachable from any student or admin browser flow. Both validate that the target user
exists, are idempotent, and record `role.admin_granted` / `role.admin_revoked` audit rows.
See `docs/seed-admin.md`.

## Update — 2026-08-02 (permissions re-audit, Prompt 14 recovery)

Grants on every post-Phase-1 table were revoked and re-issued to match the
policies that actually exist. `anon` now holds `SELECT` on `products`,
`prices`, `legal_documents` and `application_settings` only; every other table
is unreachable while signed out. `DELETE` is granted only where a delete
policy exists.

| Table | `anon` | `authenticated` | Notes |
| --- | --- | --- | --- |
| `organization_api_keys` | none | SELECT (safe columns) | `key_hash` not selectable; admins only |
| `scim_provisioning_tokens` | none | SELECT (safe columns) | `token_hash` not selectable |
| `organization_webhooks` | none | SELECT (safe columns) | `secret` not selectable |
| `api_request_logs`, `organization_sso_configurations` | none | SELECT | organisation admins only |
| billing, invoices, entitlements, notifications, audit tables | none | SELECT | writes only via security-definer routines |
| `products`, `prices` | SELECT (active) | SELECT, INSERT, UPDATE | admin-visible inactive rows via the authenticated policy |

No `SECURITY DEFINER` function is executable by `anon`. Trigger functions and
`digest_secret` are executable by `service_role` only. Full details:
`docs/security-audit-permissions-current.md`.
