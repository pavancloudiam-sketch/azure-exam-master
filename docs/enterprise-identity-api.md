# Enterprise identity, public API and webhooks

Phase 6, milestone 2. Everything here is tenant scoped: an organisation admin
can only configure and read their own organisation, and the database re-checks
that on every call. Nothing in this milestone claims certified standards
compliance — see "What is not done yet".

## Sign-in methods

| Method | Status | Notes |
| --- | --- | --- |
| Email and password | Live | Default for every account. |
| Google | Live | Managed provider, launched from the sign-in page with the app origin as the redirect target. |
| Microsoft Entra ID (SAML 2.0) | Configuration only | Metadata URL, email domains and verified redirect URLs are stored; federation is not yet active. |
| Generic OpenID Connect | Configuration only | Issuer URL and client id are stored; no tokens are exchanged yet. |

Configuration lives in `organization_sso_configurations` (one row per
organisation, written through `upsert_organization_sso`). Redirect URLs are an
explicit allow-list: a URL that is not listed is not a valid return target.
No client secrets are stored in this table — secret material belongs in the
server secret store, never in a tenant-readable row.

## API keys

- Issued with `create_organization_api_key` by an organisation admin.
- Format `ame_<prefix>.<48 hex chars>`. Only `sha256(full key)` is stored, so a
  lost key cannot be recovered — issue a new one.
- Scopes are read-only in this milestone: `org:read`, `members:read`,
  `attempts:read`, `results:read`, `webhooks:read`. A leaked key cannot mutate
  a tenant.
- Each key carries an hourly request limit (default 1000) and an optional
  expiry. `revoke_organization_api_key` disables it immediately.

## Public API

Base path `/api/public/v1`. Authenticate with
`Authorization: Bearer ame_…`.

| Endpoint | Scope | Returns |
| --- | --- | --- |
| `GET /api/public/v1/organization` | `org:read` | The key's own organisation profile. |
| `GET /api/public/v1/members?limit=&offset=` | `members:read` | Members of the key's own organisation, paginated. |

Responses carry an `x-request-id` header. Errors use
`{ "error": "...", "message": "..." }` with 401 (missing, unknown, revoked or
expired key), 403 (missing scope) and 429 (rate limited).

The organisation id is always taken from the key. Query parameters cannot
widen the tenant boundary; this is covered by a test.

Every request — including rejected ones — is recorded in `api_request_logs`
with method, path, status, outcome, duration and request id, readable by that
organisation's admins only.

## Webhooks

Register endpoints with `create_organization_webhook`. Only `https` targets
are accepted. The signing secret is returned exactly once; listings expose a
fingerprint (`whsec_…`) only.

Each delivery carries:

```
x-askmeexam-signature: t=<unix seconds>,v1=<hex hmac sha256>
x-askmeexam-event: <event type>
x-askmeexam-idempotency-key: <stable key>
```

The signature is computed over `"<timestamp>.<raw body>"` using the endpoint
secret. Verify it with a constant-time comparison and reject timestamps that
are far from your clock. Deliveries are idempotent: the same idempotency key
identifies the same logical event, so a repeat is safe to ignore. Delivery
outcomes are stored in `webhook_deliveries`.

## SCIM provisioning plan (not implemented)

Planned shape for a later milestone, recorded here so the data model does not
drift:

1. `/api/public/v1/scim/v2/Users` and `/Groups`, authenticated with a
   dedicated `scim:write` API key rather than a session.
2. Tenant derived from the key, exactly as the read API does today; the SCIM
   `externalId` maps to `organization_members.user_id`.
3. `POST` invites, `PATCH active=false` deactivates the membership rather than
   deleting data, and `DELETE` maps to the existing removal routine so
   attempts and results are preserved.
4. Rate limiting and request logging reuse `api_request_logs`.

## What is not done yet

- SAML and OIDC federation are stored as configuration only; no assertion or
  token validation runs. Do not describe AskMeExam as SAML or OIDC compliant.
- SCIM endpoints do not exist.
- Webhook delivery is triggered manually (test events) in this milestone;
  automatic fan-out of `member.*`, `attempt.submitted` and
  `entitlement.changed` events comes next.

## Tests

`python3 tests/enterprise-api.py` — 19 checks: SSO tenant scoping, key
issuance and digest-only storage, unknown/revoked/expired key rejection, scope
enforcement, cross-tenant reads, hourly rate limiting, webhook secret secrecy
and API request logging. All 19 pass.