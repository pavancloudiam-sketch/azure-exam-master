CREATE OR REPLACE FUNCTION public.get_attempt_review(_attempt_id uuid)
RETURNS TABLE(
  question_id uuid,
  sort_order integer,
  stem text,
  scenario text,
  question_type text,
  points integer,
  difficulty text,
  domain_name text,
  topic_name text,
  explanation text,
  marked_for_review boolean,
  selected_option_ids uuid[],
  status text,
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
    q.difficulty,
    d.name,
    t.name,
    q.explanation,
    COALESCE(aa.marked_for_review, false),
    COALESCE(aa.selected_option_ids, ARRAY[]::uuid[]),
    CASE
      WHEN aa.id IS NULL OR COALESCE(array_length(aa.selected_option_ids, 1), 0) = 0 THEN 'unanswered'
      WHEN COALESCE(aa.is_correct, false) THEN 'correct'
      ELSE 'incorrect'
    END,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'content', o.content,
        'sort_order', o.sort_order,
        'is_correct', o.is_correct
      ) ORDER BY o.sort_order)
      FROM public.question_options o
      WHERE o.question_id = q.id
    ), '[]'::jsonb)
  FROM public.attempts a
  JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
  JOIN public.questions q ON q.id = eq.question_id
  LEFT JOIN public.topics t ON t.id = q.topic_id
  LEFT JOIN public.domains d ON d.id = t.domain_id
  LEFT JOIN public.attempt_answers aa
    ON aa.attempt_id = a.id AND aa.question_id = q.id
  WHERE a.id = _attempt_id
    AND a.status = 'submitted'
    AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ORDER BY eq.sort_order, q.created_at
$function$;

REVOKE ALL ON FUNCTION public.get_attempt_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_review(uuid) TO authenticated, service_role;