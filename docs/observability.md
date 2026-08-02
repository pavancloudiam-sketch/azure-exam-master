# Observability and Error Handling (Phase 2)

Version 0.1.0. This document describes what AskMeExam logs, what it never
logs, how errors reach the user, and the operational metrics used to judge
whether the platform is healthy.

## 1. Logging model

All logging goes through `src/features/observability/logger.ts`. A log record
is a flat JSON object with stable field names:

| Field | Meaning |
| --- | --- |
| `timestamp` | ISO-8601, set by the emitter |
| `severity` | `info` \| `warn` \| `error` |
| `code` | one of the fixed event codes below |
| `message` | short, non-sensitive summary (never user input) |
| `correlation_id` | stable per browser session (`sessionStorage`) |
| `request_id` | unique per operation; shown to the user as a reference |
| `route` | path only — query strings are stripped |
| `context` | scalar diagnostics only (ids, status codes, booleans) |
| `source` | `client` (relayed) or `server` |

Browser events are emitted to the console **and** relayed, fire-and-forget, to
`POST /api/public/telemetry`, which re-emits them as one JSON line per event in
the server log. Client and server failures therefore share a single searchable
stream, and `correlation_id` links a user's client events to the server lines
they produced.

### Event codes

`auth.login_failed`, `auth.register_failed`, `auth.password_reset_failed`,
`auth.session_expired`, `authz.denied`, `attempt.autosave_failed`,
`attempt.load_failed`, `attempt.submit_failed`, `attempt.scoring_failed`,
`import.parse_failed`, `import.stage_failed`, `import.duplicate_scan_failed`,
`import.attestation_failed`, `db.query_failed`, `ui.unhandled_error`,
`server.unexpected_error`, `health.check_failed`.

Codes are a closed enum on both client and server; the telemetry endpoint
rejects anything else with `400`.

### Where each required category is logged

| Category | Location |
| --- | --- |
| Login / registration / reset failures | `src/routes/auth.tsx`, `src/features/auth/services/auth-service.ts` |
| Authorization failures | `src/routes/_authenticated/_admin.tsx` (`authz.denied`) |
| Autosave failures | `src/features/attempts/hooks/use-exam-engine.ts` |
| Submission and scoring failures | same hook — scoring runs inside `submit_attempt`, so the event carries the attempt id |
| Import failures | `src/features/import/services/import-service.ts` |
| Database errors | service layer, `db.query_failed` (e.g. `has_role` lookup) |
| Unexpected UI/server errors | root error component, `AppErrorBoundary`, `window` error + `unhandledrejection` listeners, `errorMiddleware` in `src/start.ts` |

## 2. What is never logged

Redaction (`src/features/observability/redact.ts`) is applied to every record
before it leaves the browser:

* **Dropped by key** (never masked, so they cannot be reconstructed): anything
  matching `password`, `token`, `secret`, `key`, `apikey`, `authorization`,
  `cookie`, `session`, `jwt`, `bearer`, `credential`, `answer`, `option_ids`,
  `is_correct`, `explanation`, `email`, `full_name`, `phone`.
* **Masked by value shape**: JWTs, `sb_publishable_*` / `sb_secret_*` keys,
  `Bearer …` strings, and email addresses found inside free text.
* **Dropped by type**: objects, arrays and functions. Nested payloads are the
  most common way answer keys and personal data leak into logs, so `context`
  accepts scalars only.
* Messages are truncated at 200 characters; telemetry bodies above 4 KB are
  rejected.

Correct-answer payloads, selected-option arrays and explanations can therefore
never appear in a log line. User identity is represented by
`correlation_id`, not by email or user id.

## 3. Error handling in the UI

`describeError()` maps any thrown value to a `FriendlyError`: a title, a plain
message, explicit **retry guidance**, `retryable`, `sessionExpired`, and a
short support reference derived from `request_id`. Internal detail (SQL text,
constraint names, stack traces) is never rendered.

Recognised classes:

* **Session expired** (401, `jwt expired`, `refresh token`, `not authenticated`)
  → "Sign in again — any answers already saved are safe", with a direct link to
  `/auth`. During an exam, autosave surfaces a non-destructive warning instead
  of tearing down the attempt.
* **Authorization denied** (403, RLS / `permission denied` / `admin role required`)
  → not retryable; contact an administrator.
* **Offline / network** → retry in a few seconds.
* **429** → wait about a minute.
* **Everything else** → generic message plus the reference.

Fallback surfaces:

* `AppErrorBoundary` (`boundary` prop names the area in logs) wraps the router
  outlet and can wrap any feature; it logs `ui.unhandled_error` and renders
  `ErrorFallback` with a **Try again** button that resets the boundary.
* The root `errorComponent` renders the same fallback and calls
  `router.invalidate()` on retry.
* `src/start.ts` `errorMiddleware` already converts unexpected server errors
  into a safe HTML error page (no stack traces).

## 4. Health checks

`GET /api/public/health` (no auth, `cache-control: no-store`) returns:

```json
{"status":"ok","version":"0.1.0","timestamp":"…","duration_ms":942,
 "checks":{"app":{"status":"ok"},
           "database":{"status":"ok","latency_ms":576},
           "auth":{"status":"ok","latency_ms":365}}}
```

`200` when every check is `ok`, `503` when any check fails (`status:
"degraded"`), so uptime monitors alert on status code alone. The database probe
is a HEAD count — it exercises PostgREST, the pooler and Postgres and returns
no rows. Failures also emit `health.check_failed` to the server log.

## 5. External error monitoring — recommendation only

**No external error-monitoring service is configured.** Logs currently live in
the platform's server logs and the browser console; there is no alerting,
retention beyond the platform default, or release tracking.

Recommended: **Sentry** (`@sentry/react` + the TanStack Start/Cloudflare
Workers SDK). It fits because it supports source-mapped React stack traces,
Workers-compatible transport, release health, and — importantly for this app —
`beforeSend` scrubbing that can enforce the same deny-list used in
`redact.ts`. Alternatives: Better Stack (cheap log retention plus alerting) or
Axiom (good fit if the JSON-line server logs are shipped as-is).

Integration would be roughly: add the DSN as a secret, initialise in
`src/router.tsx` and `src/start.ts`, forward `logEvent` records as breadcrumbs,
capture `ui.unhandled_error` / `server.unexpected_error` as exceptions, and set
`sendDefaultPii: false` plus a `beforeSend` hook reusing `redactContext`.

## 6. Operational metrics

Definitions are given so each metric can be computed from the JSON log stream
without ambiguity. Windows are rolling unless stated.

| Metric | Definition | Target | Alert |
| --- | --- | --- | --- |
| Login error rate | `count(code=auth.login_failed) / count(login attempts)` per hour | < 15 % | > 30 % for 15 min, or any spike > 50 attempts/min from one `correlation_id` (credential stuffing) |
| Autosave failure rate | `count(code=attempt.autosave_failed) / count(answer saves)` per hour | < 0.5 % | > 2 % for 10 min |
| Submission failure rate | `count(code=attempt.submit_failed) / count(submissions)` per day | < 0.1 % | any 3 failures in 10 min |
| Scoring failure rate | `attempt.submit_failed` where the DB call raised (subset by `error_code`) | 0 | any occurrence |
| Server error rate | 5xx responses ÷ total requests | < 0.5 % | > 1 % for 10 min |
| Database query latency | `checks.database.latency_ms` from `/api/public/health`, plus `pg_stat_statements` p95 for the top statements | p95 < 300 ms | p95 > 800 ms for 15 min |
| Page-load performance | LCP p75 on `/dashboard`, `/exams`, `/attempt/$attemptId` | < 2.5 s | > 4 s p75 |
| Health availability | share of `/api/public/health` probes returning 200 | > 99.5 % monthly | 2 consecutive 503s |
| Authorization denials | `count(code=authz.denied)` per hour | ~0 | > 20/hour (probing) |
| Import failure rate | `count(code=import.*_failed) / count(import operations)` | < 5 % | > 20 % in a day |

Baselines should be captured over the first week of real traffic; the targets
above are starting points, not measured values.

## 7. Manual verification

* `GET /api/public/health` → `200` with all three checks `ok`.
* `POST /api/public/telemetry` with a valid event → `204`; with an unknown
  `code` → `400`; with a > 4 KB body → `413`.
* Failed sign-in → user sees a plain message with a reference; the server log
  contains `auth.login_failed` and **no** email or password.
* Student opening `/admin/*` → redirected to `/dashboard`; log contains
  `authz.denied`.
