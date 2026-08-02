-- PostgREST upserts send the conflict-key columns in the UPDATE too, so the
-- client needs UPDATE on them. Ownership is still enforced by RLS
-- (owns_attempt), and `is_correct` remains unwritable from the browser.
GRANT UPDATE (attempt_id, question_id) ON public.attempt_answers TO authenticated;