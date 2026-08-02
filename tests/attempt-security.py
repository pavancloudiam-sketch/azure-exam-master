"""
AskMeExam - attempt, timer and scoring attack suite (Prompt 15 recovery).

Exercises the 19 required attack scenarios plus optional scoring/robustness
checks directly against the database/API boundary (PostgREST + RPC), never
through the UI.

Run:
    python3 tests/attempt-security.py

Required env (names only - never commit values):
    SUPABASE_URL           project API base url
    SUPABASE_ANON_KEY      publishable key
    TEST_ADMIN_EMAIL       existing admin test account (test env only)
    TEST_ADMIN_PASSWORD    password for that account
Optional env:
    TEST_EXAM_ID           seeded practice exam used as the question source
    SKIP_EXPIRY=1          skip the ~70s wall-clock deadline scenarios (10-12, 19)

SAFETY: run only against a dedicated test environment. The suite creates a
throwaway exam prefixed ZZ-TEST and throwaway student accounts, and deletes the
exam (cascading its attempts/answers) at the end. Auth users cannot be deleted
from the API and are left behind by design.
"""
import json, os, time, uuid, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
ADMIN_EMAIL = os.environ["TEST_ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]
SOURCE_EXAM = os.environ.get("TEST_EXAM_ID", "4f7da025-90f4-4bdc-bc94-12577bb21be7")
SKIP_EXPIRY = os.environ.get("SKIP_EXPIRY") == "1"
PREFIX = "ZZ-TEST"

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

def anon_call(path, method="GET", body=None):
    return call(path, method, None, body)

def signup(email, password="AttemptSuite!2345"):
    call("/auth/v1/signup", "POST", body={"email": email, "password": password})
    s, b = call("/auth/v1/token?grant_type=password", "POST",
                body={"email": email, "password": password})
    if s >= 400:
        raise SystemExit(f"login failed for {email}: {s} {b}")
    return b["access_token"], b["user"]["id"]

def login(email, password):
    s, b = call("/auth/v1/token?grant_type=password", "POST",
                body={"email": email, "password": password})
    if s >= 400:
        raise SystemExit(f"admin login failed: {s} {b}")
    return b["access_token"], b["user"]["id"]

RESULTS = []
EVIDENCE = []
def check(name, cond, detail=""):
    ok = bool(cond)
    RESULTS.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))
    if not ok:
        EVIDENCE.append({"scenario": name, "detail": detail})

def denied(status, body):
    """True when the API refused the call (auth, RLS, grant or validation)."""
    return status >= 400 or (isinstance(body, dict) and body.get("code"))

def upsert_answer(token, payload):
    return call("/rest/v1/attempt_answers?on_conflict=attempt_id,question_id", "POST", token,
                [payload], {"Prefer": "resolution=merge-duplicates,return=representation"})

# --------------------------------------------------------------- fixtures ---
def build_fixture(admin):
    """Isolated ZZ-TEST exam (1 minute timed) reusing seeded questions."""
    s, exams = call(f"/rest/v1/exams?id=eq.{SOURCE_EXAM}&select=certification_id", token=admin)
    if s >= 400 or not exams:
        raise SystemExit(f"source exam unreadable: {s} {exams}")
    cert = exams[0]["certification_id"]
    stamp = int(time.time())
    s, created = call("/rest/v1/exams", "POST", admin, [{
        "certification_id": cert,
        "title": f"{PREFIX} attempt-security {stamp}",
        "description": "Throwaway exam created by tests/attempt-security.py",
        "time_limit_minutes": 1,
        "question_count": 4,
        "passing_score": 700,
        "is_published": True,
        "is_active": True,
        "allow_timed": True,
        "allow_practice": True,
    }], {"Prefer": "return=representation"})
    if s >= 400:
        raise SystemExit(f"could not create test exam: {s} {created}")
    exam_id = created[0]["id"]

    s, qs = call(f"/rest/v1/exam_questions?exam_id=eq.{SOURCE_EXAM}"
                 "&select=question_id,sort_order&order=sort_order&limit=4", token=admin)
    if s >= 400 or not qs:
        raise SystemExit(f"no source questions: {s} {qs}")
    rows = [{"exam_id": exam_id, "question_id": q["question_id"], "sort_order": i}
            for i, q in enumerate(qs)]
    s, _ = call("/rest/v1/exam_questions", "POST", admin, rows)
    if s >= 400:
        raise SystemExit(f"could not attach questions: {s}")
    qids = [r["question_id"] for r in rows]

    # answer key, read with the admin token, used to verify server scoring
    key = {}
    for qid in qids:
        s, opts = call(f"/rest/v1/question_options?question_id=eq.{qid}"
                       "&select=id,is_correct", token=admin)
        key[qid] = {"all": [o["id"] for o in opts],
                    "correct": sorted(o["id"] for o in opts if o["is_correct"])}
    return exam_id, qids, key

def cleanup(admin, exam_id):
    call(f"/rest/v1/exam_questions?exam_id=eq.{exam_id}", "DELETE", admin)
    s, _ = call(f"/rest/v1/exams?id=eq.{exam_id}", "DELETE", admin)
    print(f"\ncleanup: removed test exam {exam_id} (status {s}); "
          "attempts and answers cascade with it")

# ------------------------------------------------------------------- main ---
def main():
    stamp = int(time.time())
    admin, admin_id = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    a_tok, a_id = signup(f"{PREFIX.lower()}-student-a-{stamp}@askmeexam.test")
    b_tok, b_id = signup(f"{PREFIX.lower()}-student-b-{stamp}@askmeexam.test")
    exam_id, qids, key = build_fixture(admin)
    foreign_q = None
    s, other = call(f"/rest/v1/exam_questions?exam_id=eq.{SOURCE_EXAM}&select=question_id", token=admin)
    for row in other or []:
        if row["question_id"] not in qids:
            foreign_q = row["question_id"]
            break

    try:
        run(admin, a_tok, a_id, b_tok, b_id, exam_id, qids, key, foreign_q)
    finally:
        cleanup(admin, exam_id)
        passed = sum(1 for _, ok in RESULTS if ok)
        print(f"\n{passed}/{len(RESULTS)} checks passed")
        if EVIDENCE:
            print("\nFAILURE EVIDENCE")
            print(json.dumps(EVIDENCE, indent=2))
            raise SystemExit(1)

def run(admin, a_tok, a_id, b_tok, b_id, exam_id, qids, key, foreign_q):
    # 1 - anonymous start
    s, b = anon_call("/rest/v1/rpc/start_attempt", "POST",
                     {"_exam_id": exam_id, "_mode": "practice"})
    check("1 anonymous user cannot start an exam", denied(s, b), f"{s} {b}")

    # 2 - student starts for themselves
    s, att = call("/rest/v1/rpc/start_attempt", "POST", a_tok,
                  {"_exam_id": exam_id, "_mode": "practice"})
    att = att[0] if isinstance(att, list) else att
    check("2 student starts an attempt owned by auth.uid()",
          s < 400 and att and att["user_id"] == a_id and att["status"] == "in_progress",
          f"{s} {att}")
    attempt = att["id"]

    # 3 - supplying another user id
    s, spoof = call("/rest/v1/rpc/start_attempt", "POST", a_tok,
                    {"_exam_id": exam_id, "_mode": "practice", "_user_id": b_id})
    spoofed_ok = denied(s, spoof) or (spoof and (spoof[0] if isinstance(spoof, list) else spoof)["user_id"] == a_id)
    s2, direct = call("/rest/v1/attempts", "POST", a_tok,
                      [{"user_id": b_id, "exam_id": exam_id, "mode": "practice"}])
    check("3 supplied user id is ignored and direct insert is denied",
          spoofed_ok and denied(s2, direct), f"rpc={s} insert={s2} {direct}")

    # 4 - duplicate active attempt
    s, again = call("/rest/v1/rpc/start_attempt", "POST", a_tok,
                    {"_exam_id": exam_id, "_mode": "practice"})
    again = again[0] if isinstance(again, list) else again
    check("4 second start returns the existing in-progress attempt",
          s < 400 and again and again["id"] == attempt, f"{s} {again}")

    # baseline answer by student A
    q0, q1 = qids[0], qids[1]
    s, saved = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q0,
                                     "selected_option_ids": [key[q0]["all"][0]],
                                     "marked_for_review": True})
    check("autosave writes the owner's answer", s < 400 and saved, f"{s} {saved}")

    # 5 / 6 - cross-student reads
    s, rows = call(f"/rest/v1/attempts?id=eq.{attempt}&select=*", token=b_tok)
    check("5 other student cannot read the attempt", s < 400 and rows == [], f"{s} {rows}")
    s, rows = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}&select=*", token=b_tok)
    check("6 other student cannot read the attempt answers", s < 400 and rows == [], f"{s} {rows}")

    # 7 - cross-student write
    s, bad = upsert_answer(b_tok, {"attempt_id": attempt, "question_id": q0,
                                   "selected_option_ids": [key[q0]["all"][1]]})
    s2, patched = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}", "PATCH", b_tok,
                       {"selected_option_ids": []}, {"Prefer": "return=representation"})
    s3, mine = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}&select=selected_option_ids",
                    token=a_tok)
    check("7 other student cannot modify the answer",
          denied(s, bad) and (denied(s2, patched) or patched == [])
          and mine and mine[0]["selected_option_ids"] == [key[q0]["all"][0]],
          f"insert={s} patch={s2} stored={mine}")

    # 8 - question outside the attempt's exam
    s, bad = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": foreign_q,
                                   "selected_option_ids": []})
    check("8 answer for an unassigned question is rejected", denied(s, bad), f"{s} {bad}")

    # 9 - direct attempt mutation
    before = call(f"/rest/v1/attempts?id=eq.{attempt}&select=*", token=a_tok)[1][0]
    s, r1 = call(f"/rest/v1/attempts?id=eq.{attempt}", "PATCH", a_tok,
                 {"status": "submitted", "exam_id": exam_id, "user_id": a_id,
                  "scaled_score": 1000, "passed": True},
                 {"Prefer": "return=representation"})
    s2, r2 = call("/rest/v1/exam_questions", "POST", a_tok,
                  [{"exam_id": exam_id, "question_id": foreign_q, "sort_order": 99}])
    after = call(f"/rest/v1/attempts?id=eq.{attempt}&select=*", token=a_tok)[1][0]
    check("9 direct edits to attempt/exam wiring are rejected",
          (denied(s, r1) or r1 == []) and denied(s2, r2) and after == before,
          f"attempt_patch={s} exam_questions={s2}")

    # 14 - client-supplied correctness / score
    s, ans = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q1,
                                   "selected_option_ids": [key[q1]["all"][0]],
                                   "is_correct": True,
                                   "answered_at": "1999-01-01T00:00:00Z"})
    stored = ans[0] if isinstance(ans, list) and ans else {}
    check("14 client-supplied correctness and timestamp are ignored",
          s < 400 and stored.get("is_correct") is None
          and not str(stored.get("answered_at", "")).startswith("1999"),
          f"{s} {stored}")

    # 15 - option from a different question
    other_opt = key[qids[2]]["all"][0]
    s, bad = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q0,
                                   "selected_option_ids": [key[q0]["all"][0], other_opt]})
    s2, still = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}&question_id=eq.{q0}"
                     "&select=selected_option_ids", token=a_tok)
    check("15 options from another question are rejected",
          denied(s, bad) and still and still[0]["selected_option_ids"] == [key[q0]["all"][0]],
          f"{s} {bad} stored={still}")

    # 16 / 17 - review + results before submission
    s, rows = call("/rest/v1/rpc/get_attempt_review", "POST", a_tok, {"_attempt_id": attempt})
    check("16 review of an in-progress attempt returns nothing", s < 400 and rows == [], f"{s} {rows}")
    s, rows = call("/rest/v1/rpc/get_attempt_result", "POST", a_tok, {"_attempt_id": attempt})
    check("17 results before submission return nothing", s < 400 and rows == [], f"{s} {rows}")

    # optional - empty answer clears, mark-for-review persists, duplicate autosave
    s, cleared = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q1,
                                       "selected_option_ids": [], "marked_for_review": True})
    check("opt empty selection clears the answer and keeps the flag",
          s < 400 and cleared[0]["selected_option_ids"] == [] and cleared[0]["marked_for_review"],
          f"{s} {cleared}")
    for _ in range(3):
        upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q0,
                              "selected_option_ids": key[q0]["correct"],
                              "marked_for_review": False})
    s, rows = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}&question_id=eq.{q0}"
                   "&select=id", token=a_tok)
    check("opt duplicate autosave keeps one row per question", s < 400 and len(rows) == 1, f"{rows}")
    s, bad = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q0,
                                   "selected_option_ids": ["not-a-uuid"]})
    check("opt malformed option array is rejected", denied(s, bad), f"{s} {bad}")
    s, bad = call("/rest/v1/rpc/get_attempt_result", "POST", a_tok, {"_attempt_id": "not-a-uuid"})
    check("opt invalid uuid is rejected", denied(s, bad), f"{s}")
    s, bad = call("/rest/v1/rpc/submit_attempt", "POST", a_tok,
                  {"_attempt_id": str(uuid.uuid4())})
    check("opt submitting an unknown attempt is rejected", denied(s, bad), f"{s}")

    # answer the rest with a known mix so scoring can be verified independently
    q2, q3 = qids[2], qids[3]
    upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q2,
                          "selected_option_ids": key[q2]["correct"][:1]})  # partial / wrong
    # q3 deliberately unanswered
    expected_correct = {q0: True, q1: False, q2: key[q2]["correct"][:1] == key[q2]["correct"],
                        q3: False}

    # 13 + concurrency - submit twice, concurrently
    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(call, "/rest/v1/rpc/submit_attempt", "POST", a_tok, {"_attempt_id": attempt})
        f2 = pool.submit(call, "/rest/v1/rpc/submit_attempt", "POST", a_tok, {"_attempt_id": attempt})
        (s1, r1), (s2, r2) = f1.result(), f2.result()
    r1 = r1[0] if isinstance(r1, list) else r1
    r2 = r2[0] if isinstance(r2, list) else r2
    check("13 concurrent duplicate submissions do not rescore",
          s1 < 400 and s2 < 400 and r1["submitted_at"] == r2["submitted_at"]
          and r1["scaled_score"] == r2["scaled_score"], f"{s1}/{s2} {r1} {r2}")
    s, r3 = call("/rest/v1/rpc/submit_attempt", "POST", a_tok, {"_attempt_id": attempt})
    r3 = r3[0] if isinstance(r3, list) else r3
    check("13b re-submission is idempotent",
          s < 400 and r3["submitted_at"] == r1["submitted_at"]
          and r3["scaled_score"] == r1["scaled_score"], f"{s} {r3}")

    # scoring integrity, computed independently from the admin-read answer key
    s, answers = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}"
                      "&select=question_id,selected_option_ids,is_correct", token=a_tok)
    exp_raw = sum(1 for qid in qids
                  if sorted(next((a["selected_option_ids"] for a in answers
                                  if a["question_id"] == qid), [])) == key[qid]["correct"])
    exp_scaled = round(exp_raw / len(qids) * 1000)
    check("14b server score is computed server side and matches the key",
          r1["raw_score"] == exp_raw and r1["max_score"] == len(qids)
          and abs(r1["scaled_score"] - exp_scaled) <= 1 and r1["passed"] == (r1["scaled_score"] >= 700),
          f"server={r1['raw_score']}/{r1['max_score']} scaled={r1['scaled_score']} expected={exp_raw}/{exp_scaled}")
    mc = [a for a in answers if a["question_id"] == q2]
    check("opt multiple-choice needs an exact match (no partial credit)",
          not mc or mc[0]["is_correct"] is (sorted(mc[0]["selected_option_ids"]) == key[q2]["correct"]),
          f"{mc}")
    unanswered = [a for a in answers if a["question_id"] == q3]
    check("opt unanswered question scores zero and stores no answer row",
          unanswered == [] or unanswered[0]["is_correct"] is False, f"{unanswered}")

    # 18 / 19 - writes after submission
    s, bad = upsert_answer(a_tok, {"attempt_id": attempt, "question_id": q0,
                                   "selected_option_ids": key[q0]["correct"]})
    s2, patch = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}&question_id=eq.{q1}",
                     "PATCH", a_tok, {"selected_option_ids": key[q1]["correct"]},
                     {"Prefer": "return=representation"})
    s3, after = call(f"/rest/v1/attempt_answers?attempt_id=eq.{attempt}"
                     "&select=question_id,selected_option_ids,is_correct", token=a_tok)
    check("18 a submitted attempt cannot be resumed",
          denied(s, bad) and (denied(s2, patch) or patch == []), f"insert={s} patch={s2}")
    check("19 replayed autosave after submission leaves answers unchanged",
          sorted(map(json.dumps, after or []), key=str) == sorted(map(json.dumps, answers or []), key=str),
          f"before={answers} after={after}")
    s, r = call("/rest/v1/rpc/cancel_attempt", "POST", a_tok, {"_attempt_id": attempt})
    r = r[0] if isinstance(r, list) else r
    check("18b cancelling a submitted attempt does not change it",
          s < 400 and r["status"] == "submitted", f"{s} {r}")

    # 10 / 11 / 12 - timer authority (timed attempt on the 1-minute test exam)
    if SKIP_EXPIRY:
        print("SKIP  10-12 expiry scenarios (SKIP_EXPIRY=1)")
        return
    s, timed = call("/rest/v1/rpc/start_attempt", "POST", a_tok,
                    {"_exam_id": exam_id, "_mode": "timed"})
    timed = timed[0] if isinstance(timed, list) else timed
    t_id = timed["id"]
    s, remaining = call("/rest/v1/rpc/get_attempt_time_remaining", "POST", a_tok,
                        {"_attempt_id": t_id})
    s2, forged = call(f"/rest/v1/attempts?id=eq.{t_id}", "PATCH", a_tok,
                      {"expires_at": "2099-01-01T00:00:00Z"}, {"Prefer": "return=representation"})
    s3, remaining2 = call("/rest/v1/rpc/get_attempt_time_remaining", "POST", a_tok,
                          {"_attempt_id": t_id})
    check("10 client cannot extend the authoritative deadline",
          (denied(s2, forged) or forged == []) and remaining2 <= remaining and remaining2 <= 60,
          f"before={remaining} patch={s2} after={remaining2}")

    upsert_answer(a_tok, {"attempt_id": t_id, "question_id": q0,
                          "selected_option_ids": [key[q0]["all"][0]]})
    print(f"      waiting {remaining2 + 12}s for the server deadline to pass...")
    time.sleep(remaining2 + 12)

    s, bad = upsert_answer(a_tok, {"attempt_id": t_id, "question_id": q1,
                                   "selected_option_ids": key[q1]["correct"]})
    s2, stored = call(f"/rest/v1/attempt_answers?attempt_id=eq.{t_id}&select=question_id", token=a_tok)
    check("11 answers sent after the deadline are rejected",
          denied(s, bad) and [r["question_id"] for r in stored] == [q0], f"{s} stored={stored}")
    s, rem = call("/rest/v1/rpc/get_attempt_time_remaining", "POST", a_tok, {"_attempt_id": t_id})
    check("11b no extra time is granted after expiry", rem == 0, f"{rem}")
    s, done = call("/rest/v1/rpc/submit_attempt", "POST", a_tok, {"_attempt_id": t_id})
    done = done[0] if isinstance(done, list) else done
    check("12 late submission is scored without granting extra time",
          s < 400 and done["status"] == "submitted" and done["duration_seconds"] <= 60,
          f"{s} {done}")
    s, bad = upsert_answer(a_tok, {"attempt_id": t_id, "question_id": q1,
                                   "selected_option_ids": key[q1]["correct"]})
    check("19b autosave replay on the expired attempt is rejected", denied(s, bad), f"{s}")

if __name__ == "__main__":
    main()
