-- Restrict grading columns on attempt_answers to service_role only.
REVOKE SELECT ON public.attempt_answers FROM authenticated;
GRANT SELECT (id, attempt_id, question_id, selected_option_ids, answered_at, marked_for_review, statement_responses)
  ON public.attempt_answers TO authenticated;

-- Keep write paths intact
GRANT INSERT, UPDATE ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;