# Phase 6 checkpoint — accessibility, data rights and enterprise validation

Status date: this document reports only what has actually been executed. Items
marked **PLANNED** have not been run and must not be treated as evidence.

**AskMeExam is not certified enterprise-ready.** Several validation activities in
section 7 have not been performed, and production capacity is unknown because no
load test has been run.

## 1. Enterprise features completed

| Area | State | Notes |
| --- | --- | --- |
| Organisations, members, roles, settings | Implemented and tested | Separate `organization_roles` table prevents self-promotion. |
| Tenant-aware audit logs | Implemented and tested | `audit_logs.organization_id`, insert-only. |
| Organisation entitlements | Implemented | Grants exam access to members via `has_org_exam_access`. |
| Organisation SSO configuration | Implemented, **not standards-tested** | Stores SAML/OIDC metadata, verified redirect URLs, enforcement flag. No live IdP handshake has been performed. |
| Google sign-in | Implemented | Microsoft Entra ID sign-in is **not implemented**. |
| Public API v1 (`/organization`, `/members`) | Implemented and tested | Hashed keys, scopes, hourly rate limit, revocation. |
| Webhooks | Implemented, delivery **not load-tested** | HMAC SHA-256 signatures, idempotency keys, delivery records. |
| SCIM | **Design only** | Token table exists; no SCIM endpoints. |
| Data exports (user and organisation) | Implemented | JSON payload, expiring download, audited. |
| Account and organisation deletion | Implemented as reviewed workflow | Grace period, admin decision, audit trail. |
| Retention controls | Implemented | Platform default plus per-tenant override, applied by a scheduled job. |

## 2. Security tests actually executed

| Suite | Result |
| --- | --- |
| `tests/attack.py` — permissions and data exposure | Passed after fixes; explanations gated behind a definer function. |
| Attempts, timer and scoring audit | Passed; attempt creation, timing and scoring are server-side only. |
| `tests/tenant-isolation.py` | 16/16 checks passed across two tenants and three roles. |
| `tests/enterprise-api.py` | 19/19 checks passed: tenant isolation, scope enforcement, rate limiting, revocation, secret non-disclosure. |

Not executed: penetration test by a third party, SSO handshake abuse tests,
SCIM tenant-isolation tests (no endpoints), webhook replay testing at volume.

## 3. Accessibility findings (WCAG 2.1 AA baseline)

Method: automated `axe-core` scan across public, student, exam and admin routes,
plus manual keyboard walkthroughs of the exam runner and dialogs.

Found and fixed:

1. **Colour contrast (serious, 4 instances).** Azure accent text and badge text
   fell below 4.5:1 on white and tinted surfaces. Added dedicated `-ink` tokens
   (`--accent-ink`, `--success-ink`, `--warning-ink`, `--destructive-ink`) and
   applied them to page headers, status badges, feedback components, the result
   summary and the exam timer.
2. **Question changes were silent to screen readers.** Added a visually hidden
   `aria-live="polite"` region to the exam runner announcing "Question X of Y",
   answered state and autosave status.
3. **Timer was unusable for non-visual users.** The countdown stays
   `aria-live="off"` to avoid per-second noise; assertive milestone
   announcements fire at 30, 15, 10, 5, 2 and 1 minutes and at time up.
4. **Palette tap targets below 44px on mobile.** Question palette buttons are
   now 44px on small screens and 36px from `sm` upwards.

Verified as already conforming: form labels and programmatic association,
visible focus rings, focus order, dialog focus trapping and Escape handling
(Radix primitives), semantic landmarks with a single `<main>`, error messages
linked to inputs, and responsive text sizing without loss of content at 200%.

Not verified: testing with real assistive technology (NVDA, JAWS, VoiceOver) and
testing with users who rely on it. Automated scans cover roughly a third of
WCAG criteria; **no conformance claim is made**.

## 4. Data-rights design

**User export.** `export_my_data()` builds a JSON document containing profile,
attempts and answers, results, orders, invoices, refunds, entitlements,
consents, AI usage and AI coach reports. Exam questions, option text, answer
keys and explanations are excluded — they are AskMeExam content, not personal
data. The row is stored in `data_export_requests`, expires after the configured
TTL, and every download is recorded.

**Organisation export.** `export_organization_data()` requires an organisation
owner or admin and returns organisation profile, settings, members, roles,
entitlements, SSO configuration (without secrets), API key *metadata* (never
hashes), webhook endpoints (never signing secrets) and tenant audit logs.
Members' individual exam answers are not included; those belong to the member.

**Account deletion.** `request_account_deletion()` opens a request with a grace
period from the retention policy. A platform admin approves, rejects or
completes it. Completion anonymises the profile, removes organisation
memberships and roles, revokes entitlements, and clears AI history. Orders,
invoices, refunds and financial audit rows are retained in de-identified form
because Indian tax and consumer-protection rules require them; this is stated in
the UI before the user confirms.

**Organisation deletion.** Same shape, requested by an owner and decided by a
platform admin. Members keep their personal accounts, attempts and results.

**Retention controls.** `retention_policies` holds one platform default row plus
optional per-tenant rows covering AI log days, API log days, export TTL hours
and deletion grace days. `apply_retention_policies()` runs on a schedule to
expire export payloads and prune logs.

**Consent records.** `legal_acceptances` stores the document version, context
and timestamp for every acceptance and is surfaced read-only at `/privacy`.

**Auditability.** Every export, deletion request, decision, retention change and
download writes an `audit_logs` row with actor, entity and details.

## 5. Infrastructure risks

- **Queue reliability is unproven.** Email notifications and webhook deliveries
  are queue rows drained by scheduled jobs; there is no dead-letter handling,
  no backoff tuning and no measured throughput.
- **No measured backup restoration.** Managed backups exist, but no restore has
  been performed, so recovery point and recovery time objectives are unknown.
- **No disaster-recovery runbook exercise.** Single-region deployment.
- **Capacity unknown.** No load test has been run; do not publish concurrency
  or throughput figures.
- **Scheduled jobs are single points of failure.** A failed `pg_cron` run is
  currently detected only by inspecting logs.
- **External error monitoring is recommended but not connected.** Structured
  logs and telemetry exist; there is no alerting destination.
- **Deletion completion is admin-triggered.** No automated execution at the end
  of the grace period, so a backlog is possible.

## 6. Unfinished enterprise work

- Microsoft Entra ID / Azure AD sign-in.
- Live SAML and OIDC handshakes; the current SSO record is configuration only.
- SCIM 2.0 endpoints (`/Users`, `/Groups`) and provisioning sync.
- Public API breadth: attempts, results and entitlement endpoints; OpenAPI spec.
- Webhook retry with exponential backoff and a dead-letter queue.
- Automated deletion execution and per-tenant attempt retention enforcement.
- Seat-limit enforcement on organisation entitlements.
- Real payment activation (still test mode) and India tax confirmation.

## 7. Production validation checklist

Each item states the measurement, not an assumption. All are **PLANNED** unless
marked otherwise.

| # | Test | Method | Pass criterion | State |
| --- | --- | --- | --- | --- |
| 1 | Cross-tenant isolation | Re-run `tests/tenant-isolation.py` against production configuration, plus manual attempts to read another tenant via API keys and RPC arguments | Zero cross-tenant reads or writes | Passed in preview; **PLANNED** for production |
| 2 | SSO | Configure a real Okta/Entra tenant, sign in, test unverified redirect URL, expired assertion, wrong audience, replayed assertion | Only valid assertions to verified URLs create sessions | **PLANNED** |
| 3 | SCIM | Once endpoints exist, provision, update and deprovision users from the IdP; attempt a cross-tenant token | Lifecycle works; cross-tenant token rejected | **PLANNED** |
| 4 | API rate limits | Drive an authenticated key past its hourly quota from concurrent clients | Requests over quota return 429; counters isolated per key | Passed at low volume; concurrency test **PLANNED** |
| 5 | Webhooks | Deliver to a signature-verifying receiver; test wrong secret, replayed id, receiver 500, receiver timeout | Signature verified, duplicates ignored, failures recorded and retried | Basic path passed; failure-mode tests **PLANNED** |
| 6 | Queue reliability | Inject 10k queued notifications and webhook events; kill and restart the worker mid-drain | No lost or duplicated messages; drain rate recorded | **PLANNED** |
| 7 | Backup restoration | Restore a backup into a scratch environment, verify row counts and a sample attempt end to end | Restore completes; measured RPO and RTO recorded | **PLANNED** |
| 8 | Disaster recovery | Runbook rehearsal covering database loss and application-tier loss | Documented, timed recovery with named owners | **PLANNED** |
| 9 | Load testing | Ramped test on exam start, autosave and submit paths; record p50/p95/p99 and error rate | Capacity figures published only from these results | **PLANNED** |
| 10 | Accessibility | Manual NVDA, JAWS and VoiceOver passes over auth, dashboard, exam runner, results and admin; keyboard-only exam completion; 200% zoom | No blocking barrier; findings triaged before any AA claim | Automated pass done; AT testing **PLANNED** |
| 11 | Data rights | Execute a full export, deletion request, approval and completion for a test user and tenant; verify audit rows and that retained financial records are de-identified | Payload complete, deletion applied, audit intact | **PLANNED** |
| 12 | Penetration test | Third-party assessment of auth, RLS, exam integrity and the public API | No high or critical findings open | **PLANNED** |

No production-readiness claim may be made until items 1–12 are executed and
recorded here with dates and results.