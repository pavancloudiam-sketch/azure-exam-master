# Security re-audit — permissions and data exposure (Prompt 14 recovery)

Date: 2026-08-02 · Scope: every table, column, RLS policy and database routine
added after the original Phase 1 audit (`docs/security-audit-permissions.md`),
i.e. AI (Phase 3), billing and legal (Phase 4), certification versioning
(Phase 5) and the Enterprise Edition (Phase 6).

Method: catalogue inspection of live grants, policies and function privileges,
plus black-box calls against the live Data API with the app's publishable key
as an anonymous caller.

## Findings

### F3 — Blanket Data API grants on all post-Phase-1 tables (high)

Forty tables created after the original audit carried
`SELECT, INSERT, UPDATE, DELETE` for both `anon` and `authenticated`,
regardless of what their policies actually allowed. RLS still filtered the
rows, so no data leaked, but a single accidental permissive policy — or a
future `USING (true)` convenience policy — would have exposed a table
outright, and anonymous callers could probe write paths on billing, AI and
tenant tables.

Fix: all privileges revoked from `anon` and `authenticated` on those tables,
then re-granted per table to match the policies that exist. `anon` now holds
`SELECT` on exactly four tables — `products`, `prices`, `legal_documents` and
`application_settings` — which are the public catalogue, legal and branding
surfaces. Every other table is unreachable while signed out. `DELETE` is
granted only where a delete policy exists (`ai_interview_sessions`,
`ai_interview_turns`, `import_batches`, `import_staged_rows`,
`organization_roles`); financial, audit, notification and entitlement tables
are read-only through the API and change only through security-definer
routines.

### F4 — Credential columns readable through the Data API (high)

`organization_api_keys.key_hash`, `scim_provisioning_tokens.token_hash` and
`organization_webhooks.secret` were selectable by `authenticated`. The hashes
are SHA-256 of the issued token, and the webhook secret is the raw HMAC
signing key — an organisation member could have read it and forged deliveries.

Fix: table-wide `SELECT` on those three tables was replaced with an explicit
safe-column grant. The secret columns are no longer selectable by any Data API
role; only the service-role client (server side, in
`api-auth.server.ts` and `webhooks.functions.ts`) can read them.
`listApiKeys()` selects the safe column list instead of `*`.

### F5 — Tenant credentials visible to ordinary members (medium)

`organization_api_keys`, `api_request_logs` and
`organization_sso_configurations` were readable by every active member of the
organisation. Key metadata, API traffic and identity-provider configuration
are administrative data.

Fix: those three SELECT policies now require `is_org_admin(...)` (or a
platform admin).

### F6 — Anonymous execution of application routines (medium)

Six `SECURITY DEFINER` routines were executable by `anon` via the implicit
`PUBLIC` grant: `create_certification_version`,
`retire_certification_version`, `accept_current_legal_documents`,
`exam_is_available`, `has_exam_access` and the internal trigger function
`application_settings_audit`. Each of the business routines re-checks the
caller internally, so no privilege escalation was possible, but they were
reachable unauthenticated and returned distinguishable errors.

Fix: `EXECUTE` revoked from `PUBLIC` and `anon` and re-granted to
`authenticated` / `service_role` only. Trigger functions
(`application_settings_audit`, `validate_sso_configuration`) and the hashing
helper `digest_secret` are now executable by `service_role` only.
Anonymous-executable `SECURITY DEFINER` functions: **0**.

### F7 — Internal design-system preview publicly reachable (low)

`/internal/design-system` was a top-level public route. It exposes no data,
but it is an internal surface.

Fix: the route file moved under `_authenticated/_admin/`, so the existing
session gate plus the admin role gate apply. An anonymous visit now redirects
to `/auth?redirect=%2Finternal%2Fdesign-system`.

## Verified after the fixes

| # | Check | Result |
|---|---|---|
| 1 | Anonymous read of `organizations`, `orders`, `entitlements`, `ai_usage_logs`, `organization_api_keys` | `401 permission denied` |
| 2 | Anonymous read of `products`, `prices`, `legal_documents`, `application_settings` | Allowed (active/public rows only) |
| 3 | Anonymous call to `exam_is_available` | `permission denied for function` |
| 4 | Anonymous-executable `SECURITY DEFINER` functions | 0 |
| 5 | `key_hash`, `token_hash`, webhook `secret` selectable by `authenticated` | No (column privilege denied) |
| 6 | `key_prefix` and other safe API-key columns still selectable | Yes |
| 7 | `/internal/design-system` while signed out | Redirected to `/auth` |
| 8 | `/pricing` while signed out | Renders active plans |

## Accepted by design

- Sixty-odd `SECURITY DEFINER` routines remain executable by `authenticated`.
  That is the controlled access path for this application: each re-checks
  `auth.uid()` ownership, `has_role(auth.uid(), 'admin')` or
  `is_org_admin(...)` internally and projects only safe columns. The linter
  flags them as a class; they are reviewed individually here and in
  `docs/security-audit-attempts.md`.
- `products`, `prices` and `legal_documents` are intentionally readable while
  signed out — the pricing and legal pages are public. Only rows with
  `is_active` are visible to `anon`; the admin variants of those policies are
  now scoped to `authenticated` so anonymous evaluation never touches
  `has_role`.
- `application_settings` is public by design (branding, support email,
  version). It stores no secrets.
