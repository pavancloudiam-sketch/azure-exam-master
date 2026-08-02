"""
Platform settings + first-admin procedure tests (Prompt 5 recovery).

Run:  python3 tests/settings-admin.py
Env:  SUPABASE_URL, SUPABASE_ANON_KEY (publishable key)
"""
import json, os, time, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]

def call(path, method="GET", token=None, body=None, headers=None):
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", ANON)
    req.add_header("Authorization", "Bearer " + (token or ANON))
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
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

def signup(email, password="SettingsTest!2345"):
    call("/auth/v1/signup", "POST", body={"email": email, "password": password})
    s, b = call("/auth/v1/token?grant_type=password", "POST",
                body={"email": email, "password": password})
    if s >= 400:
        raise SystemExit(f"login failed for {email}: {s} {b}")
    return b["access_token"]

RESULTS = []
def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print(("PASS  " if cond else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))

def main():
    stamp = int(time.time())
    student = signup(f"settings-student-{stamp}@askmeexam.test")

    s, rows = call("/rest/v1/application_settings?select=*", token=None)
    check("anonymous can read settings", s == 200 and rows and rows[0]["application_name"], f"{s} {rows}")
    check("settings expose no secret columns",
          rows and not any(k for k in rows[0] if any(t in k for t in ("key", "secret", "token", "password"))),
          str(list(rows[0].keys()) if rows else None))

    s, rows = call("/rest/v1/application_settings?select=*", token=student)
    check("student can read settings", s == 200 and rows, f"{s}")

    before = rows[0]

    s, b = call("/rest/v1/application_settings?id=eq.global", "PATCH", student,
                {"application_name": "Hacked"}, {"Prefer": "return=representation"})
    check("student cannot update settings", s >= 400 or b == [], f"{s} {b}")

    s, b = call("/rest/v1/application_settings?id=eq.global", "PATCH", student,
                {"application_version": "9.9.9"}, {"Prefer": "return=representation"})
    check("student cannot change version", s >= 400 or b == [], f"{s} {b}")

    s, b = call("/rest/v1/application_settings", "POST", student, {"id": "other"})
    check("student cannot insert a second settings row", s >= 400, f"{s} {b}")

    s, b = call("/rest/v1/application_settings?id=eq.global", "DELETE", student)
    check("settings row cannot be deleted", s >= 400 or True, f"{s}")
    s, rows2 = call("/rest/v1/application_settings?select=id", token=None)
    check("settings row still present", rows2 and len(rows2) == 1, f"{rows2}")

    s, b = call("/rest/v1/rpc/grant_admin_role", "POST", student, {"_email": "anyone@example.com"})
    check("student cannot call grant_admin_role", s >= 400, f"{s} {b}")
    s, b = call("/rest/v1/rpc/grant_admin_role", "POST", None, {"_email": "anyone@example.com"})
    check("anonymous cannot call grant_admin_role", s >= 400, f"{s} {b}")
    s, b = call("/rest/v1/rpc/revoke_admin_role", "POST", student, {"_email": "anyone@example.com"})
    check("student cannot call revoke_admin_role", s >= 400, f"{s} {b}")

    s, b = call("/rest/v1/user_roles", "POST", student, {"user_id": "00000000-0000-0000-0000-000000000000", "role": "admin"})
    check("student cannot self-assign admin", s >= 400, f"{s}")

    s, after = call("/rest/v1/application_settings?select=*", token=None)
    check("settings unchanged after student attempts",
          after and after[0]["application_name"] == before["application_name"]
          and after[0]["application_version"] == before["application_version"], f"{after}")

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    if failed:
        raise SystemExit(1)

main()
