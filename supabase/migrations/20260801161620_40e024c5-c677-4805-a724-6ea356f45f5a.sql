ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

ALTER TABLE public.attempts
  DROP CONSTRAINT IF EXISTS attempts_mode_check;
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_mode_check CHECK (mode IN ('timed','practice'));

ALTER TABLE public.attempt_answers
  ADD COLUMN IF NOT EXISTS marked_for_review boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS attempt_answers_attempt_question_key
  ON public.attempt_answers (attempt_id, question_id);

CREATE OR REPLACE FUNCTION public.get_attempt_questions(_attempt_id uuid)
RETURNS TABLE(
  question_id uuid,
  sort_order integer,
  stem text,
  scenario text,
  question_type text,
  points integer,
  options jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    q.id,
    eq.sort_order,
    q.stem,
    q.scenario,
    q.question_type,
    q.points,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'content', o.content,
        'sort_order', o.sort_order
      ) ORDER BY o.sort_order)
      FROM public.question_options o
      WHERE o.question_id = q.id
    ), '[]'::jsonb)
  FROM public.attempts a
  JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
  JOIN public.questions q ON q.id = eq.question_id
  WHERE a.id = _attempt_id
    AND a.user_id = auth.uid()
  ORDER BY eq.sort_order, q.created_at
$function$;

REVOKE EXECUTE ON FUNCTION public.get_attempt_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_questions(uuid) TO authenticated;