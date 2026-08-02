"""
Review-screen authorization tests (Prompt 13 recovery).

Asserts that get_attempt_review only returns answer keys and explanations to
the owner of a *submitted* attempt, and that an in-progress attempt or another
student's attempt yields nothing.

Run:  python3 tests/review-access.py
Env:  SUPABASE_URL, SUPABASE_ANON_KEY (publishable key)
"""
import json, os, time, urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
EXAM = "4f7da025-90f4-4bdc-bc94-12577bb21be7"

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

def signup(email, password="ReviewTest!2345"):
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
    owner = signup(f"review-owner-{stamp}@askmeexam.test")
    other = signup(f"review-other-{stamp}@askmeexam.test")

    s, attempt = call("/rest/v1/rpc/start_attempt", "POST", owner,
                      {"_exam_id": EXAM, "_mode": "practice"})
    check("owner can start an attempt", s < 400 and attempt, f"{s} {attempt}")
    attempt_id = attempt["id"] if isinstance(attempt, dict) else attempt[0]["id"]

    s, rows = call("/rest/v1/rpc/get_attempt_review", "POST", owner, {"_attempt_id": attempt_id})
    check("in-progress attempt exposes no review data", s < 400 and rows == [], f"{s} {rows}")

    s, _ = call("/rest/v1/rpc/submit_attempt", "POST", owner, {"_attempt_id": attempt_id})
    check("owner can submit the attempt", s < 400, str(s))

    s, rows = call("/rest/v1/rpc/get_attempt_review", "POST", owner, {"_attempt_id": attempt_id})
    check("owner sees the review after submission", s < 400 and rows, f"{s} {len(rows or [])} rows")
    if rows:
        first = rows[0]
        check("review rows carry the answer key", any(o["is_correct"] for o in first["options"]))
        check("review rows carry taxonomy", "domain_name" in first and "topic_name" in first)
        check("review rows carry a status", first["status"] in ("correct", "incorrect", "unanswered"))

    s, rows = call("/rest/v1/rpc/get_attempt_review", "POST", other, {"_attempt_id": attempt_id})
    check("another student sees nothing", s < 400 and rows == [], f"{s} {rows}")

    s, rows = call("/rest/v1/rpc/get_attempt_review", "POST", None, {"_attempt_id": attempt_id})
    check("anonymous callers see nothing", rows in ([], None) or s >= 400, f"{s} {rows}")

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    if failed:
        raise SystemExit("failures: " + ", ".join(failed))

main()
