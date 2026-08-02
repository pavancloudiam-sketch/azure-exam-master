"""
Cross-tenant isolation tests for AskMeExam Phase 6 (multi-tenant foundation).

Creates two tenants with a member each, plus one individual student who
belongs to no organisation, then asserts that row level security and the
server-side organisation routines block every cross-tenant path.

Run:  python3 tests/tenant-isolation.py
Env:  SUPABASE_URL, SUPABASE_ANON_KEY (publishable key)
"""
import json, os, sys, time, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]

def call(path, method="GET", token=None, body=None, prefer=None):
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", ANON)
    req.add_header("Authorization", "Bearer " + (token or ANON))
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

def signup(email, password="TenantTest!2345"):
    s, b = call("/auth/v1/signup", "POST", body={"email": email, "password": password})
    if s >= 400 and "already" not in json.dumps(b).lower():
        raise SystemExit(f"signup failed {s} {b}")
    s, b = call("/auth/v1/token?grant_type=password", "POST",
                body={"email": email, "password": password})
    if s >= 400:
        raise SystemExit(f"login failed for {email}: {s} {b}")
    return b["access_token"], b["user"]["id"]

RESULTS = []
def check(name, condition, detail=""):
    RESULTS.append((name, bool(condition), detail))
    print(("PASS  " if condition else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))

def main():
    # Fixed fixture accounts so the tenants can be seeded once and re-tested.
    stamp = "fixture"
    a_tok, a_id = signup("tenant-a-owner@askmeexam.test")
    b_tok, b_id = signup("tenant-b-member@askmeexam.test")
    solo_tok, solo_id = signup("solo-student@askmeexam.test")
    print(json.dumps({"tenant_a_user": a_id, "tenant_b_user": b_id, "individual": solo_id}, indent=2))

    org_a = os.environ["ORG_A_ID"]
    org_b = os.environ["ORG_B_ID"]

    # 1. A member sees only their own organisation
    s, rows = call("/rest/v1/organizations?select=id,name", token=a_tok)
    ids = {r["id"] for r in (rows or [])}
    check("1 org admin lists only own organisation", ids == {org_a}, str(ids))

    # 2. Direct fetch of the other tenant's organisation row returns nothing
    s, rows = call(f"/rest/v1/organizations?id=eq.{org_b}&select=id", token=a_tok)
    check("2 cross-tenant organisation row hidden", rows == [], str(rows))

    # 3. Cross-tenant member list is empty
    s, rows = call(f"/rest/v1/organization_members?organization_id=eq.{org_b}&select=id", token=a_tok)
    check("3 cross-tenant member list hidden", rows == [], str(rows))

    # 4. Cross-tenant settings hidden
    s, rows = call(f"/rest/v1/organization_settings?organization_id=eq.{org_b}&select=id", token=a_tok)
    check("4 cross-tenant settings hidden", rows == [], str(rows))

    # 5. Cross-tenant entitlements hidden
    s, rows = call(f"/rest/v1/organization_entitlements?organization_id=eq.{org_b}&select=id", token=a_tok)
    check("5 cross-tenant entitlements hidden", rows == [], str(rows))

    # 6. Cross-tenant audit logs hidden
    s, rows = call(f"/rest/v1/audit_logs?organization_id=eq.{org_b}&select=id", token=a_tok)
    check("6 cross-tenant audit logs hidden", rows == [], str(rows))

    # 7. Org admin of A cannot invite into B
    s, b = call("/rest/v1/rpc/invite_organization_member", "POST", token=a_tok,
                body={"_org_id": org_b, "_email": "solo-student@askmeexam.test", "_role": "member"})
    check("7 cross-tenant invite rejected", s >= 400, f"{s} {json.dumps(b)[:120]}")

    # 8. Org admin of A cannot remove a member of B
    s, b = call("/rest/v1/rpc/remove_organization_member", "POST", token=a_tok,
                body={"_org_id": org_b, "_user_id": b_id})
    check("8 cross-tenant member removal rejected", s >= 400, f"{s} {json.dumps(b)[:120]}")

    # 9. Org admin of A cannot update organisation B
    s, b = call(f"/rest/v1/organizations?id=eq.{org_b}", "PATCH", token=a_tok,
                body={"name": "Hijacked"}, prefer="return=representation")
    check("9 cross-tenant organisation update blocked", s >= 400 or b == [], f"{s} {b}")

    # 10. Org admin of A cannot update settings of B
    s, b = call(f"/rest/v1/organization_settings?organization_id=eq.{org_b}", "PATCH", token=a_tok,
                body={"seat_limit": 9999}, prefer="return=representation")
    check("10 cross-tenant settings update blocked", s >= 400 or b == [], f"{s} {b}")

    # 11. A plain member cannot grant themselves an organisation role
    s, b = call("/rest/v1/organization_roles", "POST", token=b_tok,
                body={"organization_id": org_b, "user_id": b_id, "role": "owner"},
                prefer="return=representation")
    check("11 self role escalation blocked", s >= 400, f"{s} {json.dumps(b)[:120]}")

    # 12. An outsider cannot join an organisation by inserting a membership
    s, b = call("/rest/v1/organization_members", "POST", token=solo_tok,
                body={"organization_id": org_a, "user_id": solo_id, "status": "active"},
                prefer="return=representation")
    check("12 self-join membership blocked", s >= 400, f"{s} {json.dumps(b)[:120]}")

    # 13. Non platform admin cannot create an organisation
    s, b = call("/rest/v1/rpc/create_organization", "POST", token=b_tok,
                body={"_name": "Rogue Ltd", "_slug": "rogue-tenant"})
    check("13 non platform admin cannot create organisation", s >= 400, f"{s} {json.dumps(b)[:120]}")

    # 14. Outsider cannot accept an invitation that does not exist
    s, b = call("/rest/v1/rpc/accept_organization_invitation", "POST", token=solo_tok,
                body={"_org_id": org_a})
    check("14 accepting a non-existent invitation rejected", s >= 400, f"{s} {json.dumps(b)[:120]}")

    # 15. Anonymous access to every tenant table is denied/empty
    anon_ok = True
    detail = []
    for table in ["organizations", "organization_members", "organization_roles",
                  "organization_settings", "organization_entitlements"]:
        s, b = call(f"/rest/v1/{table}?select=id")
        if not (s >= 400 or b == []):
            anon_ok = False
            detail.append(f"{table}:{s}")
    check("15 anonymous cannot read tenant tables", anon_ok, ",".join(detail))

    # 16. Individual student with no organisation still works
    s, rows = call("/rest/v1/organizations?select=id", token=solo_tok)
    ok_solo = rows == []
    s2, exams = call("/rest/v1/exams?select=id&limit=1", token=solo_tok)
    check("16 individual student unaffected", ok_solo and s2 < 400, f"orgs={rows} exams_status={s2}")

    failed = [n for n, ok, _ in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    if failed:
        print("FAILED: " + ", ".join(failed))
        sys.exit(1)

main()
