-- 1. Result columns on attempts
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS raw_score integer,
  ADD COLUMN IF NOT EXISTS max_score integer,
  ADD COLUMN IF NOT EXISTS percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS scaled_score integer,
  ADD COLUMN IF NOT EXISTS passed boolean,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

-- 2. Lock down what the client may write.
-- The browser may create an attempt and edit its own answers, but must never
-- write score, correctness, pass/fail or status values.
REVOKE UPDATE, INSERT ON public.attempts FROM authenticated;
GRANT INSERT (exam_id, user_id, mode, expires_at) ON public.attempts TO authenticated;

REVOKE UPDATE, INSERT ON public.attempt_answers FROM authenticated;
GRANT INSERT (attempt_id, question_id, selected_option_ids, marked_for_review, answered_at)
  ON public.attempt_answers TO authenticated;
GRANT UPDATE (selected_option_ids, marked_for_review, answered_at)
  ON public.attempt_answers TO authenticated;

-- 3. Atomic, ownership-checked submission + scoring.
CREATE OR REPLACE FUNCTION public.submit_attempt(_attempt_id uuid)
RETURNS public.attempts
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a public.attempts;
  v_pass integer;
  v_raw integer := 0;
  v_max integer := 0;
  v_scaled integer := 0;
  v_pct numeric(5,2) := 0;
  v_now timestamptz := now();
BEGIN
  -- Ownership check + row lock (prevents concurrent double scoring).
  SELECT * INTO a FROM public.attempts
  WHERE id = _attempt_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;

  -- Already finished: return as-is, never re-score.
  IF a.status <> 'in_progress' THEN
    RETURN a;
  END IF;

  SELECT e.passing_score INTO v_pass FROM public.exams e WHERE e.id = a.exam_id;
  v_pass := COALESCE(v_pass, 700);

  -- Grade every answer row: exact-set match only, no partial marks.
  UPDATE public.attempt_answers ans
  SET is_correct = (
    SELECT COALESCE(
      (SELECT array_agg(o.id ORDER BY o.id) FROM public.question_options o
        WHERE o.question_id = ans.question_id AND o.is_correct), '{}'::uuid[]
    ) = (
      SELECT COALESCE(array_agg(DISTINCT s ORDER BY s), '{}'::uuid[])
      FROM unnest(ans.selected_option_ids) AS s
    )
    AND cardinality(ans.selected_option_ids) > 0
  )
  WHERE ans.attempt_id = a.id;

  -- Raw score respects each question's point value.
  SELECT
    COALESCE(SUM(q.points), 0),
    COALESCE(SUM(CASE WHEN ans.is_correct THEN q.points ELSE 0 END), 0)
  INTO v_max, v_raw
  FROM public.exam_questions eq
  JOIN public.questions q ON q.id = eq.question_id
  LEFT JOIN public.attempt_answers ans
    ON ans.attempt_id = a.id AND ans.question_id = q.id
  WHERE eq.exam_id = a.exam_id;

  IF v_max > 0 THEN
    v_pct := ROUND((v_raw::numeric / v_max::numeric) * 100, 2);
    v_scaled := ROUND((v_raw::numeric / v_max::numeric) * 1000);
  END IF;

  UPDATE public.attempts SET
    status = 'submitted',
    submitted_at = v_now,
    duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - started_at))::integer),
    raw_score = v_raw,
    max_score = v_max,
    percentage = v_pct,
    scaled_score = v_scaled,
    passed = (v_scaled >= v_pass),
    score = v_scaled
  WHERE id = a.id
  RETURNING * INTO a;

  RETURN a;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attempt(uuid) TO authenticated;

-- 4. Cancelling an attempt (never reported as a completed result).
CREATE OR REPLACE FUNCTION public.cancel_attempt(_attempt_id uuid)
RETURNS public.attempts
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE a public.attempts;
BEGIN
  UPDATE public.attempts
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = _attempt_id AND user_id = auth.uid() AND status = 'in_progress'
  RETURNING * INTO a;

  IF NOT FOUND THEN
    SELECT * INTO a FROM public.attempts WHERE id = _attempt_id AND user_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  END IF;
  RETURN a;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_attempt(uuid) TO authenticated;

-- 5. Result summary + domain breakdown for a submitted attempt.
CREATE OR REPLACE FUNCTION public.get_attempt_result(_attempt_id uuid)
RETURNS TABLE(
  attempt_id uuid,
  exam_title text,
  mode text,
  submitted_at timestamp with time zone,
  duration_seconds integer,
  raw_score integer,
  max_score integer,
  percentage numeric,
  scaled_score integer,
  passing_score integer,
  passed boolean,
  total_questions integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  domains jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      COALESCE(d.name, 'Unassigned') AS domain_name,
      COALESCE(d.sort_order, 9999) AS domain_sort,
      COALESCE(ans.is_correct, false) AS is_correct,
      COALESCE(cardinality(ans.selected_option_ids), 0) = 0 AS unanswered
    FROM a
    JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
    JOIN public.questions q ON q.id = eq.question_id
    LEFT JOIN public.topics t ON t.id = q.topic_id
    LEFT JOIN public.domains d ON d.id = t.domain_id
    LEFT JOIN public.attempt_answers ans
      ON ans.attempt_id = a.id AND ans.question_id = q.id
  ),
  per_domain AS (
    SELECT domain_name, domain_sort,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_correct)::int AS correct
    FROM rows GROUP BY domain_name, domain_sort
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
    e.passing_score,
    a.passed,
    (SELECT COUNT(*)::int FROM rows),
    (SELECT COUNT(*) FILTER (WHERE is_correct)::int FROM rows),
    (SELECT COUNT(*) FILTER (WHERE NOT is_correct AND NOT unanswered)::int FROM rows),
    (SELECT COUNT(*) FILTER (WHERE unanswered)::int FROM rows),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', pd.domain_name,
        'total', pd.total,
        'correct', pd.correct,
        'percentage', CASE WHEN pd.total > 0
          THEN ROUND((pd.correct::numeric / pd.total::numeric) * 100, 1) ELSE 0 END
      ) ORDER BY pd.domain_sort, pd.domain_name)
      FROM per_domain pd
    ), '[]'::jsonb)
  FROM a JOIN public.exams e ON e.id = a.exam_id
$function$;

REVOKE ALL ON FUNCTION public.get_attempt_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_result(uuid) TO authenticated;