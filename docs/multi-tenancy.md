# Multi-tenant foundation (Phase 6)

AskMeExam Enterprise Edition begins with tenant isolation only. White
labelling and single sign-on are deliberately **not** part of this release.

## Data model

| Table | Purpose |
| --- | --- |
| `organizations` | The tenant: name, slug, contact email, `status` (`active`/`suspended`). |
| `organization_members` | Who belongs to a tenant, with `status` `invited` / `active` / `removed`, plus who invited them and when they joined. |
| `organization_roles` | Tenant-level roles (`owner`, `admin`, `manager`, `member`) held in a **separate** table so a member can never promote themselves by editing their own membership row. |
| `organization_settings` | One row per tenant: timezone, default certification, seat limit, optional email-domain self join. |
| `organization_entitlements` | Tenant-wide access grants (`all` / `certification` / `exam`) with start, expiry and revocation. |
| `audit_logs.organization_id` | Makes the existing audit log tenant aware. |

## Authorisation layers

1. **Row level security** on every tenant table. Reads are limited to active
   members of the row's organisation (`public.is_org_member`), writes to
   organisation owners/admins (`public.is_org_admin`), with platform admins
   (`public.has_role(auth.uid(), 'admin')`) able to administer all tenants.
   All helpers are `SECURITY DEFINER` with a fixed `search_path`, which keeps
   the membership lookups out of recursive policy evaluation.
2. **Server-side routines** for every state change:
   `create_organization` (platform admin only), `invite_organization_member`,
   `remove_organization_member`, `accept_organization_invitation`. Each
   re-checks the caller's role, so a tampered request from the browser fails
   even if the UI would have hidden the control.
3. **Frontend filtering is convenience only.** The React layer never decides
   access; it only reflects what the database already allowed.

## Membership rules

- Students join a tenant **only** by invitation or administrative assignment.
  Self-insert into `organization_members` is rejected by RLS.
- An invited user may move their own membership from `invited` to `active`
  and nothing else.
- Role grants require `user_id <> auth.uid()`, so no one can grant themselves
  a role, and only an owner (or a platform admin) may grant ownership.
- Removing a member sets `status = 'removed'` and deletes their tenant roles;
  their attempts, results and individual purchases are untouched.

## Platform admins vs organisation admins

`public.user_roles` (`student` / `admin`) remains the platform-level role
model and is entirely separate from `organization_roles`. An organisation
owner has no platform privileges, and a platform admin holds no organisation
role unless explicitly added as a member.

## Individual students keep working

Nothing about attempts, scoring, entitlements or billing changed. A student
with no membership sees an empty organisation page and keeps their individual
entitlements. `public.has_org_exam_access(user, exam)` is additive: tenant
access supplements, never replaces, `public.has_exam_access`.

## Cross-tenant tests

`tests/tenant-isolation.py` drives the live Data API with three real
accounts (tenant A owner, tenant B member, individual student) and asserts
16 checks:

1. A member lists only their own organisation.
2. A cross-tenant organisation row is invisible.
3. Cross-tenant member lists are invisible.
4. Cross-tenant settings are invisible.
5. Cross-tenant entitlements are invisible.
6. Cross-tenant audit logs are invisible.
7. Inviting into another tenant is rejected.
8. Removing another tenant's member is rejected.
9. Updating another tenant's organisation row affects nothing.
10. Updating another tenant's settings affects nothing.
11. Granting yourself an organisation role is rejected.
12. Inserting your own membership into a tenant is rejected.
13. A non platform admin cannot create an organisation.
14. Accepting a non-existent invitation is rejected.
15. Anonymous callers read nothing from any tenant table.
16. An individual student with no tenant is unaffected.

Run with:

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
ORG_A_ID=... ORG_B_ID=... python3 tests/tenant-isolation.py
```

Latest run: **16/16 checks passed**.

## Not in this phase

White labelling, SSO/SCIM, organisation-level reporting dashboards, seat
enforcement at purchase time, and bulk learner assignment.