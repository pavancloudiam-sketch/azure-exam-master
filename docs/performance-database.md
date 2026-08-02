# Phase 2 — Database and query optimization

No product behaviour changed. Everything below is indexing, query selectivity
and request-count work, measured before and after.

## Measurement method

- `pg_stat_statements` (via the slow-query report) for statement cost ranking.
- `pg_stat_user_indexes` / `pg_indexes` for index usage and duplication.
- `EXPLAIN (ANALYZE, BUFFERS)` for plan shape.
- A Playwright harness that counts every PostgREST request a page issues and
  sums the response bytes (`/dashboard`, `/exams`, `/admin/questions`).

Current data volume is small (16 question options, 11 attempts, 4 questions),
so the planner correctly prefers sequential scans and wall-clock timings are
all sub-millisecond. Index adoption was therefore verified with
`SET enable_seqscan = off`, which shows the planner picks the new indexes as
soon as the tables outgrow a single page. Request counts and payload sizes are
measurable today and are reported as real before/after numbers.

## Indexes removed

| Index | Reason |
| --- | --- |
| `attempt_answers_attempt_question_key` | Exact duplicate of the constraint index `attempt_answers_attempt_id_question_id_key`. The slowest statement in the workload is the answer-autosave upsert on `attempt_answers`; it had to maintain two identical unique indexes on every keystroke-driven save. Dropping it halves that index maintenance with no read loss. |

## Indexes added

| Index | Query it supports |
| --- | --- |
| `attempts_user_started_idx (user_id, started_at DESC)` | Dashboard attempt history: `select … from attempts order by started_at desc limit 20` under the `user_id = auth.uid()` RLS predicate. Verified: `Index Scan using attempts_user_started_idx`. |
| `attempts_user_active_idx (user_id, exam_id) WHERE status = 'in_progress'` | `start_attempt()` live-attempt reuse lookup, and the resume path. Partial, so it stays tiny regardless of history size. |
| `attempts_exam_submitted_idx (exam_id) WHERE status = 'submitted'` | `get_question_stats()` — attempt counts and observed pass rate join `attempts` by `exam_id` for submitted attempts only. Replaces the general `attempts_exam_status_idx` for that path. |
| `question_options_question_idx (question_id, sort_order)` | Every exam question render, `get_attempt_questions()`, `submit_attempt()` grading, and `options_fingerprint()` during duplicate scanning. This foreign key had no index at all. Verified: `Index Scan using question_options_question_idx`. |
| `domains_certification_idx (certification_id, sort_order)` | Admin domain list and the certification → domain cascade filter. Unindexed FK. |
| `topics_domain_idx (domain_id, sort_order)` | Admin topic list and the domain → topic cascade filter. Unindexed FK. |
| `exams_certification_idx (certification_id)` | Exam lists scoped by certification. Unindexed FK. |
| `questions_exam_idx (exam_id) WHERE exam_id IS NOT NULL` | The legacy direct question → exam link, still filtered on in admin views. Partial because most rows are bank questions with a null `exam_id`. |
| `questions_browse_idx (certification_id, is_archived, created_at DESC)` | Admin question bank default browse: non-archived questions for a certification, newest first. Covers the ordering as well as the filter, so no sort step at scale. |

Indexes deliberately **not** added: `audit_logs(actor_id)` (the log is only ever
read newest-first, already served by `audit_logs_created_at_idx`),
`import_batches(attested_by)` and `import_staged_rows(reviewed_by)` (staging is
transient, 24-hour scoped, and always read by batch id).

`questions_tags_idx` and `questions_stem_trgm_idx` currently show zero scans but
are retained: they serve the tag filter and free-text search, which are only
exercised once an admin types a query.

## Query and request-shape improvements

| Change | Before | After |
| --- | --- | --- |
| Dashboard attempt history selected `*` from `attempts` with no limit and ran twice per mount (effect-based fetch). Now selects only the seven rendered columns, caps at 20 rows, and is cached/de-duplicated by React Query. | 3 requests, **10 750 bytes** | 2 requests, **2 499 bytes** (−77%) |
| Exam list ran the same read twice per mount. Now a single cached query. | 3 requests, 806 bytes | 2 requests, **405 bytes** (−50%) |
| Exam runner header loaded the attempt, then the exam, sequentially (two round trips, second blocked on the first). Now one embedded read: `attempts.select("id, exams(title)")`. | 2 sequential requests | **1 request** |
| Admin question list fetched the entire `exam_questions` join table with `select *` on every page load. Now scoped to the 20 question ids on the current page, selecting named columns, served by `exam_questions_question_idx`. | unbounded (whole table) | bounded to the page |

Remaining `select("*")` reads on `certifications`, `domains`, `topics` and
`exams` are left as-is: these are small, fully-rendered admin taxonomy tables
where every column is displayed or edited, so narrowing the projection would
cost clarity without reducing payload.

## Not in scope

Concurrent-user capacity was not estimated; no product features were added.
