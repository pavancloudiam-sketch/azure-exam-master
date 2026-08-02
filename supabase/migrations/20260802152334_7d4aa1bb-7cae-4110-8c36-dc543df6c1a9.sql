DROP FUNCTION IF EXISTS public.get_attempt_review(uuid);

CREATE FUNCTION public.get_attempt_review(_attempt_id uuid)
RETURNS TABLE(
  question_id uuid, sort_order integer, stem text, scenario text, question_type text,
  points integer, difficulty text, domain_name text, topic_name text, explanation text,
  marked_for_review boolean, selected_option_ids uuid[], status text, options jsonb,
  is_pilot boolean, earned_points numeric, statement_responses jsonb,
  case_study_id uuid, case_study_title text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    q.id,
    s.sort_order,
    q.stem,
    q.scenario,
    q.question_type,
    s.points,
    q.difficulty,
    d.name,
    t.name,
    q.explanation,
    COALESCE(aa.marked_for_review, false),
    COALESCE(aa.selected_option_ids, ARRAY[]::uuid[]),
    CASE
      WHEN aa.id IS NULL OR COALESCE(array_length(aa.selected_option_ids, 1), 0) = 0 THEN 'unanswered'
      WHEN COALESCE(aa.is_correct, false) THEN 'correct'
      WHEN COALESCE(aa.earned_points, 0) > 0 THEN 'partial'
      ELSE 'incorrect'
    END,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'content', o.content,
        'sort_order', COALESCE(array_position(s.option_order, o.id), o.sort_order),
        'is_correct', o.is_correct
      ) ORDER BY COALESCE(array_position(s.option_order, o.id), o.sort_order))
      FROM public.question_options o
      WHERE o.question_id = q.id
    ), '[]'::jsonb),
    s.is_pilot,
    aa.earned_points,
    COALESCE(aa.statement_responses, '{}'::jsonb),
    q.case_study_id,
    cs.title
  FROM public.attempts a
  CROSS JOIN LATERAL public.attempt_item_set(a.id) s
  JOIN public.questions q ON q.id = s.question_id
  LEFT JOIN public.topics t ON t.id = q.topic_id
  LEFT JOIN public.domains d ON d.id = t.domain_id
  LEFT JOIN public.case_studies cs ON cs.id = q.case_study_id
  LEFT JOIN public.attempt_answers aa
    ON aa.attempt_id = a.id AND aa.question_id = q.id
  WHERE a.id = _attempt_id
    AND a.status = 'submitted'
    AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ORDER BY s.sort_order, q.created_at
$function$;

DROP FUNCTION IF EXISTS public.get_attempt_result(uuid);

CREATE FUNCTION public.get_attempt_result(_attempt_id uuid)
RETURNS TABLE(
  attempt_id uuid, exam_title text, mode text, submitted_at timestamptz, duration_seconds integer,
  raw_score integer, max_score integer, percentage numeric, scaled_score integer,
  passing_score integer, passed boolean, total_questions integer, correct_count integer,
  incorrect_count integer, unanswered_count integer, domains jsonb, scoring_model_version text,
  pilot_count integer, scored_count integer, earned_points numeric, available_points numeric,
  blueprint_name text, blueprint_duration_minutes integer, blueprint_snapshot jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH a AS (
    SELECT * FROM public.attempts
    WHERE id = _attempt_id
      AND status = 'submitted'
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ),
  rows AS (
    SELECT
      q.id AS question_id,
      s.is_pilot,
      COALESCE(d.name, 'Unassigned') AS domain_name,
      COALESCE(d.sort_order, 9999) AS domain_sort,
      COALESCE(ans.is_correct, false) AS is_correct,
      COALESCE(ans.earned_points, 0) AS earned_points,
      s.points AS points,
      COALESCE(cardinality(ans.selected_option_ids), 0) = 0 AS unanswered
    FROM a
    CROSS JOIN LATERAL public.attempt_item_set(a.id) s
    JOIN public.questions q ON q.id = s.question_id
    LEFT JOIN public.topics t ON t.id = q.topic_id
    LEFT JOIN public.domains d ON d.id = t.domain_id
    LEFT JOIN public.attempt_answers ans
      ON ans.attempt_id = a.id AND ans.question_id = q.id
  ),
  per_domain AS (
    SELECT domain_name, domain_sort,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_correct)::int AS correct,
      SUM(earned_points)::numeric AS earned,
      SUM(points)::numeric AS available
    FROM rows WHERE NOT is_pilot GROUP BY domain_name, domain_sort
  )
  SELECT
    a.id,
    e.title,
    a.mode,
    a.submitted_at,
    a.duration_seconds,
    a.raw_score,
    a.max_score,
    a.percentage,
    a.scaled_score,
    COALESCE(b.passing_scaled_score, e.passing_score),
    a.passed,
    (SELECT COUNT(*)::int FROM rows),
    (SELECT COUNT(*) FILTER (WHERE r.is_correct)::int FROM rows r WHERE NOT r.is_pilot),
    (SELECT COUNT(*) FILTER (WHERE NOT r.is_correct AND NOT r.unanswered)::int FROM rows r WHERE NOT r.is_pilot),
    (SELECT COUNT(*) FILTER (WHERE r.unanswered)::int FROM rows r WHERE NOT r.is_pilot),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', pd.domain_name,
        'total', pd.total,
        'correct', pd.correct,
        'earned_points', pd.earned,
        'available_points', pd.available,
        'percentage', CASE WHEN pd.available > 0
          THEN ROUND((pd.earned / pd.available) * 100, 1) ELSE 0 END
      ) ORDER BY pd.domain_sort, pd.domain_name)
      FROM per_domain pd
    ), '[]'::jsonb),
    COALESCE(a.scoring_model_version, 'v1'),
    a.pilot_count,
    a.scored_count,
    a.earned_points,
    a.available_points,
    b.name,
    b.duration_minutes,
    a.blueprint_snapshot
  FROM a
  JOIN public.exams e ON e.id = a.exam_id
  LEFT JOIN public.exam_blueprints b ON b.id = a.blueprint_id
$function$;