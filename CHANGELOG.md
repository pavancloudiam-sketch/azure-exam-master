# Changelog

All notable changes to AskMeExam are documented in this file.

## [Unreleased]

### Agent integrations (MCP)
- The app now exposes an MCP server at `/mcp` so assistants such as Claude,
  ChatGPT, Cursor or Codex can work with AskMeExam data.
- Four read-only tools: list certifications, list published practice exams,
  list the signed-in student's own attempts, and read the scored result of one
  submitted attempt. Answer keys and other students' data are never exposed.
- Secured with OAuth 2.1 against the project's auth server: each client signs
  in as a real AskMeExam user, tool calls forward that user's token and row
  level security applies exactly as it does in the app.
- New consent page at `/.lovable/oauth/consent` for approving or denying a
  client, with the consent hand-off preserved through email/password and
  Google sign-in.

### Tenant white-label branding (Prompt 39)
- New `organization_branding` table holding each tenant's application name,
  tagline, logo, favicon, brand colours, theme mode, email branding, support
  identity, custom domain and publish state.
- Row level security keeps branding tenant-isolated: members read only their
  own organisation's branding and only owners/admins can change it.
- New `/organization/branding` management page with per-field validation, a
  live sandboxed app preview and a rendered branded-email preview.
- Tenant themes are applied at runtime through the design-system CSS
  variables, along with the tenant favicon, document title and header logo —
  and are deliberately never applied to `/admin/*`, so global administrator
  branding is untouched.
- Custom domain support: a hostname can be registered per tenant, is
  re-verified whenever it changes via a generated TXT token, and a
  presentation-only public lookup themes a verified, published domain before
  sign-in without exposing tenant data.
- Branded transactional email helper produces HTML and plain-text parts plus
  the tenant sender identity, falling back to platform branding when no tenant
  applies.

### AI Study Assistant (Prompt 29)
- New `/study` page for students, gated by the existing `ai_study_assistant`
  feature flag: explanations of incorrect answers, why the correct answer is
  correct, weak-domain analysis, personalised study plans and next-topic
  suggestions.
- Study-only chat: the assistant refuses anything outside Microsoft Entra ID
  study guidance and never reproduces live exam content.
- Server-side only: study context is built from the student's own submitted
  attempts, and requests are re-checked for feature flag, active-attempt block
  and per-student hourly/daily rate limits.
- Prompt-injection defences: student text is normalised, injection patterns are
  stripped, delimiters cannot be closed, and detections are flagged to the user.
- Every request is written to the audit log, and admins can see the enforced
  per-module rate limits on the AI settings page.
- Unit tests cover the sanitisation and conversation-safety layer.

### Autosave reliability (Prompt 11)
- Answers are now written to a durable on-device queue before being sent, so
  they survive a refresh, a lost connection or a browser restart.
- Failed saves retry automatically with exponential backoff instead of asking
  the student to re-select the answer.
- Offline is detected automatically; answers keep being recorded and are sent
  the moment the connection returns. The header shows queued/offline status.
- Submitting drains the queue first and can no longer be triggered twice
  (double click or timer expiry racing the button).
- Resuming an attempt that was answered on another device now shows a conflict
  dialog to choose which answers to keep.
- New unit suite `src/features/attempts/services/autosave-queue.test.ts`
  (`bun run test`) covering retries, offline queueing, reconnect replay, queue
  persistence, duplicate-edit collapsing and conflict detection.

### Attempt, timer and scoring attack suite (Prompt 15 recovery)
- Restored answer saving: signed-in students had lost the permission to write
  their own answers, which silently broke exam autosave. Ownership, active
  attempt and question-membership rules are unchanged.
- Answer saving now rejects options that belong to a different question.
- The correctness flag can no longer be supplied by the browser; it is set
  only by the scoring routine.
- Attempt status is constrained to in progress, submitted, expired or
  cancelled.
- New reusable suite `tests/attempt-security.py` (19 required scenarios plus
  optional scoring and robustness checks) and
  `docs/attempt-security-test-suite.md` with the state-transition table and
  scoring-security summary.

### Permissions and data-exposure re-audit (Prompt 14 recovery)
- Data API grants on every table added after Phase 1 were revoked and re-issued
  to match the access rules that exist; signed-out callers can now read only
  active products, prices, legal documents and public branding settings.
- API key hashes, SCIM token hashes and webhook signing secrets are no longer
  selectable through the Data API by any role.
- Organisation API keys, API request logs and SSO configuration are restricted
  to organisation administrators instead of every member.
- No security-definer routine is executable while signed out; trigger helpers
  are restricted to the platform.
- The internal design-system preview moved behind the admin gate.
- New `docs/security-audit-permissions-current.md`; `docs/rls-policy-matrix.md`
  updated.

### Platform settings and first-admin procedure (Prompt 5 recovery)
- New singleton `application_settings` record holding application name, tagline,
  support email, footer disclaimer, version and default exam values (passing
  scaled score 700, duration 60 minutes), seeded with the current branding.
- Public read, admin-only update, enforced by RLS; every change is audited by a
  database trigger with a safe summary of the changed fields.
- New `/admin/settings` page with runtime validation, unsaved-changes warning
  and confirmation for platform-wide changes; linked from the admin dashboard.
- Header, hero tagline and footer (disclaimer, version, support email) now read
  the stored settings through one shared cached query with compiled fallbacks;
  new exams start from the stored defaults, existing exams are untouched.
- Owner-only `grant_admin_role` / `revoke_admin_role` database routines with
  documented procedure in `docs/seed-admin.md`.

### Submitted-attempt review screen and expanded seed content (Prompt 13 recovery)
- New `/review/$attemptId` screen: question-by-question review of a submitted
  attempt with your selected answer, the correct answer, correct/incorrect/
  unanswered status, explanation, domain, topic, difficulty, point value and
  marked-for-review state, plus an attempt summary (exam, date, scaled score,
  percentage, pass/fail and the correct/incorrect/unanswered counts).
- Navigation: previous/next, a question palette and All / Correct / Incorrect /
  Unanswered / Marked-for-review filters. Status is always carried by text and
  accessible names, never by colour alone; palette buttons are 44px targets.
- Security: the review payload comes from the `get_attempt_review`
  security-definer routine, which returns rows only when the caller owns the
  attempt (or is a platform admin) AND the attempt status is `submitted`.
  Answer keys and explanations therefore stay unreachable from the browser for
  in-progress, cancelled and other students' attempts. The screen is read-only
  and cannot change answers or stored results.
- The results page now links to the review screen for submitted attempts,
  alongside the existing summary and AI Coach.
- Seed content: the Microsoft Entra ID demonstration exam now carries eleven
  original practice questions (single-choice, multiple-choice and scenario
  variants) across new identity, access and identity-protection domains and
  topics. Existing submitted attempts and their scores were not altered.

### Accessibility, data rights and enterprise validation (Phase 6 checkpoint)
- Accessibility: added higher-contrast "ink" tokens and applied them across page
  headers, badges, alerts, results and the exam timer to clear 4.5:1; the exam
  runner now announces "Question X of Y", answered state and autosave through a
  polite live region; the timer announces 30/15/10/5/2/1 minute milestones and
  time up assertively while staying silent per second; question palette buttons
  are 44px tap targets on mobile.
- Data exports: students can download a JSON copy of their profile, attempts,
  answers, results, purchases, receipts, access, consents and AI activity.
  Organisation owners and admins can export tenant data — members, roles,
  settings, access, API key metadata, webhook endpoints and audit logs — with
  secrets and key hashes excluded. Exports expire and every download is audited.
- Deletion workflows: account deletion and organisation deletion are requests
  with a grace period, cancellable by the requester and decided by a platform
  admin at `/admin/privacy`. Financial records are retained in de-identified
  form for Indian tax and consumer-protection obligations.
- Retention controls: a platform default plus optional per-organisation
  overrides for AI log days, API log days, export availability and deletion
  grace period, applied by a scheduled retention job.
- Consent records are surfaced read-only to each student at `/privacy`.
- New `docs/enterprise-validation.md` records completed enterprise features,
  the security tests that actually passed, accessibility findings, the
  data-rights design, infrastructure risks, unfinished work and a production
  validation checklist. No enterprise-readiness or capacity claim is made.

### Enterprise identity, public API and webhooks (Phase 6, milestone 2)
- Google sign-in is available on the sign-in page alongside email and
  password; the redirect target is the app's public origin so the session is
  established before any protected route is reached.
- Per-organisation sign-in configuration (`organization_sso_configurations`):
  method, branded label, email domains, verified redirect URLs, SAML metadata
  URL, OpenID Connect issuer and client id. Microsoft Entra ID (SAML) and
  generic OIDC are captured as configuration and marked pending verification —
  standards compliance is not claimed until it is tested end to end.
- Organisation API keys with one-way SHA-256 storage, a shown-once plaintext
  key, read-only scopes, per-key hourly rate limits, optional expiry and
  immediate revocation.
- Public read API under `/api/public/v1/*` (`organization`, `members`). The
  tenant is derived from the key, never from a query parameter. Every call,
  including rejected ones, is written to `api_request_logs` with a request id.
- Webhook endpoints with per-endpoint signing secrets, HMAC SHA-256
  `x-askmeexam-signature` headers, idempotency keys, delivery history and a
  "send test event" action. Listing endpoints returns a secret fingerprint
  only.
- New tests: `tests/enterprise-api.py` (19 checks covering key hashing,
  scopes, tenant isolation, rate limiting, revocation and webhook secrecy).
- Documented in `docs/enterprise-identity-api.md`, including the SCIM
  provisioning plan that is deliberately not implemented yet.

### Multi-tenant foundation (Phase 6, Enterprise Edition)
- New tenant model: `organizations`, `organization_members`,
  `organization_roles`, `organization_settings` and
  `organization_entitlements`, plus a tenant column on the audit log so
  organisation activity is recorded and readable per tenant.
- Strict isolation enforced in the database, not the browser: row level
  security on every tenant table with `is_org_member` / `is_org_admin`
  security-definer helpers, and server routines (`create_organization`,
  `invite_organization_member`, `remove_organization_member`,
  `accept_organization_invitation`) that re-check the caller's role.
- Students belong to an organisation only when invited or assigned; an invited
  user may accept their own invitation and nothing else. Organisation roles
  live in their own table and cannot be granted to yourself.
- Platform administrators stay separate from organisation administrators, and
  an organisation administrator can only manage their own organisation.
- New pages: `/admin/organizations` for platform administrators and
  `/organization` for members, sharing one organisation workspace for members,
  settings, organisation access and tenant audit activity.
- Individual students are unaffected; organisation access is additive via
  `has_org_exam_access`.
- `tests/tenant-isolation.py` covers 16 cross-tenant attack paths — all pass.
- White labelling and single sign-on are intentionally not included yet.

### Certification versioning (Phase 5)
- Certifications now carry provider, exam-code metadata, a version label,
  effective date, retirement date, lifecycle status (draft / active / retired)
  and an explicit "allow new attempts" switch. Versions of the same
  certification are grouped in a version family, unique per version label.
- Admins can add a certification, add a new version of it and optionally clone
  the earlier version's domains, weights and topics into it. New versions start
  as inactive drafts.
- Admins can retire a version with a retirement date. Retired versions stop
  accepting new attempts server-side (`start_attempt`) unless the admin
  explicitly allows them.
- Historical attempts stay tied to the version they were taken on; nothing is
  deleted and the exam engine, scoring and attempt state machine remain shared
  across all versions. Version actions are written to the audit log.

### Subscriptions, refunds, receipts and notifications (Phase 4, test mode)
- Subscription lifecycle: students see their plan, current period and renewal
  state on `/billing`, can request cancellation at period end and withdraw that
  request again. A scheduled routine expires ended subscriptions and revokes
  the entitlements they granted, so access disappears when access rights lapse.
- Refund workflow end to end: a student requests a refund with a reason from a
  paid order, an administrator approves or rejects it with a note on
  `/admin/billing`, and marking it processed revokes the entitlements the order
  granted. Students see only their own refunds; every decision is written to
  `financial_audit_logs`.
- Downloadable receipts: each paid order carries a receipt with India-oriented
  fields — buyer name, address, PIN code, optional GST number and a tax
  breakdown block. Students maintain their billing details on `/billing`.
  Receipts are labelled **AskMeExam-issued**; they are not Microsoft credentials
  and the format has **not** been reviewed for legal or GST compliance.
- Messages: purchase confirmation, payment failure, refund status, exam reminder
  and result-available notifications are queued per event with an idempotency
  key, so retries and repeated page views never produce a duplicate. Students
  read their own messages on `/billing`; administrators watch the queue and
  record delivery on `/admin/billing`. No mail provider is connected yet, so
  delivery is recorded rather than sent.
- Test-mode order simulation on `/admin/billing` creates a paid or failed order
  (with invoice, entitlement and messages) without moving any money.

### Business and legal foundation (Phase 4)
- Commercial data model for the India launch (Indian rupees only, no global tax
  configuration): `products` and `prices` (one-time exam access and monthly /
  annual subscription plans), `orders` and `order_items`, `payment_attempts`,
  `refunds`, `invoices`, `coupons` and `coupon_redemptions`, `subscriptions`,
  and `entitlements` as the single source of truth for access, resolved by the
  new `has_exam_access` function. Money is stored in paise; tax fields are
  captured but never computed because GST applicability is unconfirmed. Every
  order-side table is owner-scoped by RLS and no financial row is writable from
  the browser. `financial_audit_logs` records financial and entitlement actions
  for admins. **No payment provider is configured and no payment can be taken.**
  Model reference: `docs/business-model.md`.
- Versioned legal documents and acceptance capture: `legal_documents` holds one
  current Terms of Service, Privacy Policy and Refund Policy, each seeded as a
  clearly-marked placeholder draft, and `legal_acceptances` records which
  version each student accepted and when via the
  `accept_current_legal_documents` function (the browser cannot choose the user,
  version or timestamp). Registration now requires an acceptance checkbox and
  replays it after email confirmation. The placeholders are **not legal advice
  and do not satisfy any legal requirement** — they exist so acceptance can be
  versioned before professionally reviewed text lands.
- New pages: `/pricing` (indicative plans, payments-not-active notice),
  `/legal/terms`, `/legal/privacy`, `/legal/refunds`, and `/billing` with
  purchase history, invoices, refunds, current access and recorded acceptances.
  Footer links to pricing and all three policies.
- `docs/launch-checklist-india.md`: an explicit pre-launch checklist requiring
  written professional confirmation for payment-gateway KYC, merchant-account
  requirements, GST applicability and registration, tax treatment,
  consumer-protection obligations and privacy obligations. Nothing is ticked.
- The exam engine, scoring and attempt state are untouched.

### AskMe AI
- AskMe AI Interview Coach at `/interview`: mock Microsoft Entra ID interviews
  where the student picks topic, difficulty (beginner / intermediate /
  advanced), question style (conceptual, scenario-based, troubleshooting, or a
  mixed mock interview) and length. Each answer returns constructive feedback,
  missing concepts, a suggested improved answer and one follow-up question; the
  final turn closes with an interview summary. Questions are original by
  instruction — no certification question bank is read — and every surface
  states that feedback is practice only and never a real employer's hiring
  decision or a Microsoft endorsement. Interview history is opt-in: new
  `ai_interview_sessions` and `ai_interview_turns` tables store a transcript
  only when the student presses Save, scoped by RLS to that student. Feature
  flag, rate limit, active-attempt and conversation-length checks all re-run
  server-side on every turn.
- AskMe AI Coach (post-exam): a coach panel on the result page for **submitted
  attempts only**. Quick actions explain why the correct answer is correct, why
  the student's selection was wrong, why each distractor is wrong, simplify the
  explanation, give a real-world Microsoft Entra ID example, recommend what to
  study next, and generate a short original mini-quiz; free-form follow-up
  questions are capped by the shared conversation limits. The server re-verifies
  the feature flag, attempt ownership, submitted status, that no attempt is in
  progress, and the rate limit on every request; the browser sends ids and an
  action key only, never prompt text, and a requested question must belong to
  that attempt's exam. Stored explanations are quoted verbatim in their own
  section and separated from AI-generated guidance. Adds an
  `ai_content_reports` table plus a report-content dialog on every AI response
  so students can flag unsafe or inaccurate output for admin review. Scores are
  never read for writing — the coach cannot alter a stored result.

- Phase 3 foundation: an AI service boundary (`src/features/ai`) kept fully
  separate from the exam engine — no AI code touches scoring or attempt state.
  Adds a server-only Lovable AI Gateway provider (`LOVABLE_API_KEY` read inside
  handlers, never exposed to the browser), the shared safety prompt with the
  global AskMe AI rules, per-module prompt templates, Zod request validation,
  per-user hourly/daily rate protection, and text-free usage logging in
  `ai_usage_logs` (feature, model, status, tokens, latency, request id — never
  prompts or completions). Student data-access rules require authenticated
  ownership and a submitted attempt, and refuse AI work while any attempt is in
  progress; admin-only modules re-check the admin role server-side. Adds the
  `ai_feature_flags` table with all five modules disabled by default, an admin
  toggle page at `/admin/ai`, a reusable `AiDisclaimer` stating AskMe AI is not
  an official Microsoft source, and `docs/ai-foundation.md`.

### Observability
- Phase 2 observability and safe error handling: a structured client/server
  logging pipeline (`src/features/observability`) with a fixed event
  vocabulary, per-session correlation ids and per-operation request ids that
  double as the support reference shown to users. Failures are now logged for
  sign-in, registration, password reset, authorization denials, answer
  autosave, exam submission and scoring, imports, database queries and
  unexpected UI errors. Redaction drops passwords, tokens, keys, session data,
  correct-answer payloads, explanations and personal details before anything is
  written or relayed. Added `POST /api/public/telemetry` (closed event enum,
  4 KB cap, no database writes) which re-emits browser events as JSON server
  log lines, a real health check at `GET /api/public/health` with database and
  auth probes plus latency and a 503 on degradation, a reusable
  `AppErrorBoundary` and safe fallback screen wired into the router root,
  window error/unhandled-rejection capture, and user-facing error messages with
  explicit retry guidance and session-expiry recovery. No external
  error-monitoring service is configured; Sentry is recommended in
  `docs/observability.md`, which also defines the operational metrics (login
  error rate, autosave/submission failure rates, server error rate, database
  latency, page-load performance) with targets and alert thresholds.

### Performance
- Phase 2 database and query optimization (no feature changes): dropped a
  duplicate index on `attempt_answers` that doubled the cost of every answer
  autosave, added nine justified indexes (attempt history, attempt resume,
  question options, question statistics, admin question browse and the
  previously unindexed taxonomy foreign keys), narrowed the dashboard attempt
  read from `select *` to the rendered columns with a 20-row cap, collapsed the
  exam-runner header from two sequential reads to one embedded read, scoped the
  admin exam-assignment read to the current page, and de-duplicated
  effect-driven fetches on the dashboard and exam list. Measured: dashboard
  payload 10 750 → 2 499 bytes, exam list 806 → 405 bytes. Details and
  before/after evidence: `docs/performance-database.md`.

### Added
- Phase 1B bulk question import (staging only): documented CSV and Excel
  templates with original demonstration rows, an admin upload page at
  `/admin/import` that parses and validates files before anything is saved, and
  temporary `import_batches` / `import_staged_rows` storage scoped to the
  uploading admin. Committing staged rows into the question bank is not
  implemented yet. Format reference: `docs/import-file-format.md`.
- Duplicate and originality safeguards for staged imports: exact, normalized,
  near-identical and similar scenario/option detection against the internal
  AskMeExam question bank, per-row administrator review decisions, and a
  required originality attestation that records the attesting admin, the
  timestamp and the import id. Matches are flagged only — never auto-rejected —
  and no external plagiarism service is configured.

### Security
- Attempts can only be created through the protected `start_attempt` routine:
  it verifies the exam is published, validates the mode and derives
  `started_at`/`expires_at` from the server clock. Direct `INSERT` on
  `attempts` was revoked from signed-in users, so a client can no longer choose
  its own deadline, exam or owner.
- Timer enforcement moved to the database: answers are rejected once an
  attempt's `expires_at` has passed (10s latency grace), and the countdown is
  seeded from the new `get_attempt_time_remaining` routine and ticks on the
  monotonic clock — changing the device clock has no effect.
- Answers can only be saved for questions actually assigned to the attempt's
  exam; `answered_at` is now stamped by the server.
- Cancelling an attempt is refused once time has expired, so a failing attempt
  can no longer be discarded instead of scored.
- `duration_seconds` is clamped to the exam's time limit for timed attempts.
- Explanations stay hidden while a retake of the same exam is in progress.
- Documented the attempts/timer/scoring audit in
  `docs/security-audit-attempts.md`.
- Question explanations are no longer readable through the data layer during an
  active attempt. Column-level read access to `questions.explanation` was removed
  from signed-in users and replaced with the gated `get_question_explanations`
  function (admins, or students with a submitted attempt containing the question).
- Revoked the legacy blanket `anon` privileges on all application tables. Row Level
  Security already blocked anonymous reads; the grants themselves are now gone too.
- Documented the full permission and data-exposure audit in
  `docs/security-audit-permissions.md`.

### Added
- Secure exam submission and scoring: `submit_attempt`, `cancel_attempt` and
  `get_attempt_result` security-definer functions score attempts server-side, verify
  ownership, require an in-progress attempt, prevent duplicate scoring, lock the attempt
  and store submitted time and duration. Score columns are not writable from the browser.
- Scoring rules: exact-answer matching for single and multiple choice, no partial marks,
  question point values respected, raw/percentage/scaled (0–1000) scores compared with
  the exam passing score (700 for the demonstration exam).
- Pre-submission review dialog showing answered, unanswered and marked-for-review counts.
- Timer expiry runs the same server-side submission path as manual submit.
- Result page at `/results/$attemptId`: exam name, attempt date, raw/percentage/scaled
  score, pass or fail, time taken, question totals, correct/incorrect/unanswered counts
  and a domain-wise breakdown.
- Cancel-attempt flow; cancelled attempts are never scored and never shown as results.
- Recent attempts list on the dashboard with resume and view-result actions.
- Email/password authentication: registration, login, logout, forgot password and
  password reset, with safe redirect handling and session-aware header.
- Role model (`student`, `admin`) stored in a dedicated `user_roles` table; new users
  receive the `student` role via a database trigger. Self-assignment of `admin` is
  blocked by RLS.
- Protected route groups: `/_authenticated` (session gate) and `/_authenticated/_admin`
  (admin role gate).
- Core schema: profiles, user_roles, certifications, domains, topics, exams, questions,
  question_options, attempts, attempt_answers — all with RLS enabled and explicit grants.
- `get_question_options` security-definer function hides `is_correct` from students
  during an active attempt.
- RLS policy matrix documented in `docs/rls-policy-matrix.md`.
- Reusable design system in `src/features/shared/components/ui/`: primary/secondary/
  destructive buttons (with loading + disabled states), text/password/select/checkbox/
  radio fields with labels, hints and error messages, card, status badge, alert,
  modal, confirmation dialog, table, pagination, tabs, spinner, skeleton, empty state,
  error state, toast helpers, page header, sidebar nav, top nav and mobile nav.
- Design tokens for shadows (`shadow-card`, `shadow-raised`, `shadow-overlay`) and
  success/warning states.
- Sonner toaster mounted in the root layout.
- Internal design-system preview at `/internal/design-system` (noindex).
- Question administration at `/admin/questions`: reusable question bank with search and
  filters for certification, domain, topic, type, difficulty and status; create, edit,
  activate and deactivate flows; no permanent deletion.
- Question types: single-choice, multiple-choice and scenario variants, with scenario
  text, explanation, difficulty, point value and dynamic answer options (2–8).
- Validation enforces exactly one correct option for single-choice, at least two for
  multiple-choice, non-empty option text, required explanation, positive point value,
  valid certification/domain/topic relationships and scenario text for scenario types.
- Exam assignment modal: assign an existing question to an exam or remove it from
  future assignments (`exam_questions` join table), leaving submitted attempts intact.
- All question creates, edits, activation changes and exam assignment changes are
  recorded in the audit log.
- Student exam engine: `/exams` lists published exams and starts a timed or practice
  attempt; `/attempt/$attemptId` runs the session.
- Exam interface shows exam title, current question number, total count, scenario text,
  single- and multiple-choice options, Previous/Next, Mark for review, Clear answer and
  Submit exam, plus a question palette with current / answered / unanswered / marked /
  answered+marked states and jump-to-question.
- Countdown timer in timed mode only (auto-submits at zero); practice mode uses the same
  engine without a timer. Answers save automatically as you go.
- Keyboard navigation: ← / → move between questions, 1–9 select an option, M marks for
  review, C clears the answer.
- Questions and options for an active attempt are served by `get_attempt_questions`,
  which never selects `is_correct` or the explanation, so no answer-key data reaches
  the browser during a session.
- Admin content taxonomy management: `/admin/certifications`, `/admin/domains` and
  `/admin/topics` with create, edit and activate/deactivate flows, name search and
  active/inactive filtering (plus parent filters for domains and topics).
- Reusable `EntityFormModal` (schema-driven create/edit form) and `TaxonomyToolbar`
  shared across taxonomy pages; Zod validation in
  `src/features/admin/validation/taxonomy-schemas.ts`.
- `audit_logs` table plus `recordAudit` service; every taxonomy create, edit and
  activation change is recorded and the ten most recent entries are shown on `/admin`.
- `is_active` and `updated_at` on domains and topics, with `updated_at` triggers on
  certifications, domains and topics.
- Seeded the single Phase 1 active certification: "Microsoft Entra ID certification
  practice" (SC-300 referenced only as exam metadata).

### Changed
- Taxonomy records can no longer be deleted: admin RLS policies on certifications,
  domains and topics allow insert/update only and `DELETE` is revoked, so historical
  attempts always resolve their content. Deactivation hides records from students only.
- Student reads of domains and topics now require the record and its parents to be active.

## [0.1.0] - 2026-08-01

### Added
- Project foundation: feature-based folder structure (auth, dashboard, certifications,
  exams, questions, attempts, results, review, admin, shared), each split into
  components / services / validation / hooks / types.
- Branding shell: header with navigation, footer with independence disclaimer and
  version display.
- Design-system foundation: dark blue primary, Azure-style blue accent, light grey
  surfaces, white background, Inter Tight typography, focus-visible states.
- Routes: `/`, `/dashboard`, `/certifications`, `/admin` with per-route metadata.
- Environment variable reference (`.env.example`).
## AI Question Generator (Prompt 31)

- Admin-only AskMe AI module at `/admin/ai/generator`, behind the existing
  `ai_question_generator` feature flag.
- Generates original multiple-choice and scenario questions for a chosen
  certification, domain and topic, with difficulty and type control plus
  optional length-capped guidance.
- Trigram duplicate detection against the existing question bank, surfaced per
  draft with a similarity score.
- Every draft is fully editable before saving and is written unpublished:
  inactive, `governance_status = 'draft'`, review-flagged and tagged
  `ai-generated`, so the existing review workflow still gates publishing.
- Server-side feature flag, admin role, rate limit, prompt-injection
  sanitisation, AI usage logging and an `audit_logs` entry per generation.
- 7 new unit tests for the duplicate detector.
