-- Yes/No questions ask a Yes or No for each statement. Grading still reads
-- `selected_option_ids` (a statement answered "Yes" is a selected option), so
-- this column is presentation state only: it lets the runner tell "answered
-- No" apart from "not answered yet" after a reload or device change.
ALTER TABLE public.attempt_answers
  ADD COLUMN statement_responses jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.attempt_answers.statement_responses IS
  'Yes/No questions only: { "<option_id>": "yes" | "no" }. Never used for scoring.';