CREATE OR REPLACE FUNCTION public.check_answer_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Scoring inside submit_attempt sets this transaction-local flag; every
  -- other writer (i.e. the browser autosave path) is untrusted.
  IF COALESCE(current_setting('askmeexam.scoring', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.attempts a
    JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
    WHERE a.id = NEW.attempt_id AND eq.question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'Question is not part of this exam';
  END IF;

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

  NEW.is_correct := NULL;
  NEW.answered_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_attempt(_attempt_id uuid)
RETURNS attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.attempts;
  v_pass integer;
  v_limit integer;
  v_raw integer := 0;
  v_max integer := 0;
  v_scaled integer := 0;
  v_pct numeric(5,2) := 0;
  v_now timestamptz := now();
  v_elapsed integer;
BEGIN
  SELECT * INTO a FROM public.attempts
  WHERE id = _attempt_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.status <> 'in_progress' THEN RETURN a; END IF;

  SELECT e.passing_score, e.time_limit_minutes INTO v_pass, v_limit
  FROM public.exams e WHERE e.id = a.exam_id;
  v_pass := COALESCE(v_pass, 700);

  PERFORM set_config('askmeexam.scoring', 'on', true);

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

  v_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (v_now - a.started_at))::integer);
  IF a.mode = 'timed' AND v_limit IS NOT NULL THEN
    v_elapsed := LEAST(v_elapsed, v_limit * 60);
  END IF;

  UPDATE public.attempts SET
    status = 'submitted',
    submitted_at = v_now,
    duration_seconds = v_elapsed,
    raw_score = v_raw,
    max_score = v_max,
    percentage = v_pct,
    scaled_score = v_scaled,
    passed = (v_scaled >= v_pass),
    score = v_scaled
  WHERE id = a.id
  RETURNING * INTO a;

  PERFORM set_config('askmeexam.scoring', 'off', true);
  RETURN a;
END;
$$;