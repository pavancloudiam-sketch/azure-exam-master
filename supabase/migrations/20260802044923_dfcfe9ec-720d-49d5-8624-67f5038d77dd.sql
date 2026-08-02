-- 1. Restore the answer-write grants the autosave path needs. RLS
--    (`attempt_answers_insert_active` / `_update_active` via `owns_attempt`)
--    and the validation trigger remain the actual authorisation boundary.
GRANT INSERT, UPDATE ON public.attempt_answers TO authenticated;

-- 2. Harden the write-time validation trigger.
CREATE OR REPLACE FUNCTION public.check_answer_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.attempts a
    JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
    WHERE a.id = NEW.attempt_id AND eq.question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'Question is not part of this exam';
  END IF;

  -- Every selected option must belong to the question being answered.
  IF NEW.selected_option_ids IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM unnest(NEW.selected_option_ids) AS s(option_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.question_options o
         WHERE o.id = s.option_id AND o.question_id = NEW.question_id
       )
     ) THEN
    RAISE EXCEPTION 'Selected option does not belong to this question';
  END IF;

  -- Correctness is never client supplied; scoring sets it in submit_attempt.
  NEW.is_correct := NULL;
  -- server-owned timestamp; ignore any client value
  NEW.answered_at := now();
  RETURN NEW;
END;
$$;

-- 3. Constrain the attempt state machine to the documented values.
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_status_check
  CHECK (status IN ('in_progress', 'submitted', 'expired', 'cancelled'));