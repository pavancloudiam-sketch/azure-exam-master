DROP FUNCTION IF EXISTS public.get_attempt_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_attempt_questions(_attempt_id uuid)
RETURNS TABLE(question_id uuid, sort_order integer, stem text, scenario text,
              question_type text, points numeric, case_study_id uuid, options jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    q.id,
    aq.position,
    q.stem,
    q.scenario,
    q.question_type,
    aq.points,
    q.case_study_id,
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
  JOIN public.attempt_questions aq ON aq.attempt_id = a.id
  JOIN public.questions q ON q.id = aq.question_id
  WHERE a.id = _attempt_id
    AND a.user_id = auth.uid()
  ORDER BY aq.position
$$;

REVOKE ALL ON FUNCTION public.get_attempt_questions(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_attempt_questions(uuid) TO authenticated, service_role;