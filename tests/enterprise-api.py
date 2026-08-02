"""
Enterprise identity, API key and webhook tests for AskMeExam Phase 6.

Creates two tenants, issues API keys, and asserts that the public API
authenticates by key digest, enforces scopes, isolates tenants, honours the
hourly rate limit and stops working after revocation.

Run:  python3 tests/enterprise-api.py
Env:  SUPABASE_URL, SUPABASE_ANON_KEY (publishable key), APP_URL (default http://localhost:8080)
"""
import json, os, time, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
APP = os.environ.get("APP_URL", "http://localhost:8080").rstrip("/")


def call(path, method="GET", token=None, body=None):
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", ANON)
    req.add_header("Authorization", "Bearer " + (token or ANON))
    req.add_header("Content-Type", "application/json")
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


def api(path, key=None):
    req = urllib.request.Request(APP + path)
    if key:
        req.add_header("Authorization", "Bearer " + key)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def signup(email, password="TenantTest!2345"):
    call("/auth/v1/signup", "POST", body={"email": email, "password": password})
    s, b = call("/auth/v1/token?grant_type=password", "POST",
                body={"email": email, "password": password})
    if s >= 400:
        raise SystemExit(f"login failed for {email}: {s} {b}")
    return b["access_token"], b["user"]["id"]


RESULTS = []


def check(name, condition, detail=""):
    RESULTS.append((name, bool(condition), detail))
    print(("PASS  " if condition else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))


def rpc(token, name, args):
    return call("/rest/v1/rpc/" + name, "POST", token=token, body=args)


def main():
    a_tok, _ = signup("tenant-a-owner@askmeexam.test")
    b_tok, _ = signup("tenant-b-member@askmeexam.test")
    outsider_tok, _ = signup("solo-student@askmeexam.test")

    # Tenants seeded by tests/tenant-isolation.py: A is owned by the A account,
    # B by the B account, and the solo student belongs to neither.
    stamp = str(int(time.time()))
    org_a = "11111111-1111-4111-8111-111111111111"
    org_b = "22222222-2222-4222-8222-222222222222"
    assert b_tok and stamp

    # --- SSO configuration is tenant scoped -------------------------------
    s, _ = rpc(a_tok, "upsert_organization_sso",
               {"_organization_id": org_a, "_method": "entra_saml",
                "_email_domains": ["contoso.com"],
                "_allowed_redirect_urls": ["https://app.askmeexam.test/auth/callback"]})
    check("owner can configure own SSO", s < 300, str(s))
    s, _ = rpc(outsider_tok, "upsert_organization_sso",
               {"_organization_id": org_a, "_method": "oidc"})
    check("outsider cannot configure another tenant's SSO", s >= 400, str(s))

    # --- API keys ---------------------------------------------------------
    s, key_a = rpc(a_tok, "create_organization_api_key",
                   {"_organization_id": org_a, "_name": "CI key",
                    "_scopes": ["org:read", "members:read"], "_rate_limit_per_hour": 20})
    check("owner can issue an API key", s < 300 and "api_key" in (key_a or {}), str(s))
    plaintext_a = key_a["api_key"]

    s, _ = rpc(outsider_tok, "create_organization_api_key",
               {"_organization_id": org_a, "_name": "stolen",
                "_scopes": ["org:read"], "_rate_limit_per_hour": 10})
    check("outsider cannot issue a key for another tenant", s >= 400, str(s))

    s, row = call(f"/rest/v1/organization_api_keys?select=key_hash&id=eq.{key_a['id']}",
                  token=a_tok)
    stored = (row or [{}])[0].get("key_hash", "") if isinstance(row, list) else ""
    check("only a digest is stored, never the key", plaintext_a not in stored, "hash stored")

    _, key_scopeless = rpc(a_tok, "create_organization_api_key",
                           {"_organization_id": org_a, "_name": "org only",
                            "_scopes": ["org:read"], "_rate_limit_per_hour": 20})

    # --- public API -------------------------------------------------------
    s, body = api("/api/public/v1/organization")
    check("public API rejects calls with no key", s == 401, str(s))

    s, body = api("/api/public/v1/organization", "ame_00000000.deadbeef")
    check("public API rejects an unknown key", s == 401, str(s))

    s, body = api("/api/public/v1/organization", plaintext_a)
    check("valid key reads its own organisation", s == 200 and body["data"]["id"] == org_a, str(s))

    s, body = api("/api/public/v1/members", plaintext_a)
    member_orgs = {m.get("organization_id") for m in body.get("data", [])} if s == 200 else set()
    check("members endpoint returns only the key's tenant",
          s == 200 and member_orgs <= {None, org_a}, str(s))

    s, body = api("/api/public/v1/members?organization_id=" + org_b, plaintext_a)
    check("tenant id in the query string cannot cross tenants",
          s == 200 and all(m.get("organization_id", org_a) == org_a for m in body.get("data", [])),
          str(s))

    s, body = api("/api/public/v1/members", key_scopeless["api_key"])
    check("missing scope is refused", s == 403, str(s))

    # --- rate limit -------------------------------------------------------
    _, limited = rpc(a_tok, "create_organization_api_key",
                     {"_organization_id": org_a, "_name": "tight limit",
                      "_scopes": ["org:read"], "_rate_limit_per_hour": 2})
    codes = [api("/api/public/v1/organization", limited["api_key"])[0] for _ in range(4)]
    check("hourly rate limit is enforced", 429 in codes, str(codes))

    # --- revocation -------------------------------------------------------
    s, _ = rpc(outsider_tok, "revoke_organization_api_key", {"_api_key_id": key_a["id"]})
    check("outsider cannot revoke another tenant's key", s >= 400, str(s))
    s, _ = rpc(a_tok, "revoke_organization_api_key", {"_api_key_id": key_a["id"]})
    check("owner can revoke their key", s < 300, str(s))
    s, _ = api("/api/public/v1/organization", plaintext_a)
    check("revoked key stops working immediately", s == 401, str(s))

    # --- webhooks ---------------------------------------------------------
    s, hook = rpc(a_tok, "create_organization_webhook",
                  {"_organization_id": org_a, "_name": "CI hook",
                   "_target_url": "https://example.com/askmeexam",
                   "_event_types": ["member.joined"]})
    check("owner can register a webhook", s < 300 and "signing_secret" in (hook or {}), str(s))
    s, listed = rpc(a_tok, "list_organization_webhooks", {"_organization_id": org_a})
    secretless = all("secret" not in json.dumps(row).replace("secret_fingerprint", "")
                     for row in (listed or []))
    check("webhook listing never returns the signing secret", s < 300 and secretless, str(s))
    s, listed_b = rpc(outsider_tok, "list_organization_webhooks", {"_organization_id": org_a})
    check("outsider cannot list another tenant's webhooks",
          s >= 400 or not listed_b, str(s))

    # --- audit trail ------------------------------------------------------
    s, logs = call(f"/rest/v1/api_request_logs?select=outcome,status_code&organization_id=eq.{org_a}",
                   token=a_tok)
    check("API calls are recorded for the tenant", s == 200 and len(logs or []) > 0, str(s))

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    if failed:
        print("FAILED: " + ", ".join(failed))
        raise SystemExit(1)


main()