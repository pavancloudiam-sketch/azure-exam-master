# Seeding the first administrator

AskMeExam never promotes users automatically. There is no self-service role change,
no "first registered user becomes admin" rule, and no HTTP endpoint that grants roles.
The admin role is assigned only by the project owner, running a database routine.

## 1. Prerequisites

- The target person has already **registered normally** in the app (email + password) and
  their account exists in the authentication system. The routine refuses unknown users.
- You are the project owner and can run SQL against the project database
  (Lovable Cloud → backend → SQL). The routine is granted to `service_role` only;
  `anon` and `authenticated` cannot execute it, so it is unreachable from the browser.

## 2. Identify the target user

Use the email address the person registered with. To confirm the account exists:

```sql
select id, email from auth.users where lower(email) = lower('person@example.com');
```

If this returns no row, the person has not registered yet. Do not create the account manually.

## 3. Grant the admin role

```sql
select public.grant_admin_role('person@example.com');
```

Returns one of:

- `admin role granted` — the role was added and an audit entry was written.
- `admin role already present (no change)` — idempotent no-op; no duplicate row, no audit entry.

The routine is `SECURITY DEFINER` with `search_path = public`, resolves the user by email,
and relies on the `user_roles (user_id, role)` unique constraint so repeated runs can never
create duplicates.

## 4. Verify

```sql
select u.email, r.role, r.created_at
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'admin';
```

Then sign in as that user: `/admin` and `/admin/settings` should load. Students are
redirected to `/dashboard` by the `_admin` route gate, and the database still refuses
their writes even if the gate is bypassed.

## 5. Remove the admin role safely

```sql
select public.revoke_admin_role('person@example.com');
```

Returns `admin role removed` or `user did not have the admin role (no change)`.
Removing the role does not delete the account, their attempts, or their audit history.
Keep at least one admin account: with none, settings and content administration are
only reachable by re-running the grant routine.

## 6. Auditing

Both routines insert into `public.audit_logs`:

| Field | Value |
| --- | --- |
| `action` | `role.admin_granted` / `role.admin_revoked` |
| `entity_type` | `user_role` |
| `entity_id` | the target user id |
| `entity_label` | the target email address |
| `details` | `{ "role": "admin", "source": "seed_admin_procedure" }` |
| `actor_id` | the signed-in admin, or `null` when run by the project owner via SQL (system actor) |
| `created_at` | timestamp, set by the database |

No passwords, tokens or keys are recorded. Entries appear on `/admin` under
"Recent admin activity".

## 7. Common errors

| Message | Cause | Fix |
| --- | --- | --- |
| `No registered user found for that email address` | Typo, or the person never registered | Confirm with the query in step 2 |
| `An email address is required` | Empty argument | Pass the address as a quoted string |
| `permission denied for function grant_admin_role` | Executed as `anon`/`authenticated` (e.g. from the app) | Run it as the project owner in the SQL editor |
| Admin pages still redirect | Stale session | Sign out and sign in again to refresh the role check |

## 8. Security warnings

- Never expose these routines through a server function, API route or RPC call from the client.
- Never grant `EXECUTE` on them to `anon` or `authenticated`.
- Never place a service-role key in frontend code, an environment variable prefixed `VITE_`, or documentation.
- Never hardcode an admin email address in application code.
- Treat admin access as production-critical: grant it to as few accounts as possible and review
  `audit_logs` for `role.admin_granted` entries periodically.