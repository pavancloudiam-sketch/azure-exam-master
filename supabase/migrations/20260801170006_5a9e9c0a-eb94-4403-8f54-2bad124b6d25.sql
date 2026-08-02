-- 1. Ownership helper now treats an expired attempt as no longer active.
CREATE OR REPLACE FUNCTION public.owns_attempt(_attempt_id uuid, _require_active boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attempts a
    WHERE a.id = _attempt_id
      AND a.user_id = auth.uid()
      AND (
        NOT _require_active
        OR (
          a.status = 'in_progress'
          -- 10s grace absorbs network latency only; the client clock is irrelevant.
          AND (a.expires_at IS NULL OR a.expires_at > now() - interval '10 seconds')
        )
      )
  )
$$;

-- 2. Answers must belong to the attempt's own exam.
CREATE OR REPLACE FUNCTION public.check_answer_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.attempts a
    JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
    WHERE a.id = NEW.attempt_id AND eq.question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'Question is not part of this exam';
  END IF;
  -- server-owned timestamp; ignore any client value
  NEW.answered_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attempt_answers_validate ON public.attempt_answers;
CREATE TRIGGER attempt_answers_validate
  BEFORE INSERT OR UPDATE ON public.attempt_answers
  FOR EACH ROW EXECUTE FUNCTION public.check_answer_question();

-- 3. Attempt creation moves entirely server-side.
CREATE OR REPLACE FUNCTION public.start_attempt(_exam_id uuid, _mode text)
RETURNS public.attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  a public.attempts;
  e public.exams;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _mode NOT IN ('timed', 'practice') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  SELECT * INTO e FROM public.exams WHERE id = _exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;
  IF NOT e.is_published AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Exam is not available';
  END IF;
  IF _mode = 'timed' AND e.time_limit_minutes IS NULL THEN
    RAISE EXCEPTION 'This exam has no time limit configured';
  END IF;

  -- Reuse an existing live attempt instead of stacking duplicates.
  SELECT * INTO a FROM public.attempts
  WHERE user_id = uid AND exam_id = _exam_id AND status = 'in_progress'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY started_at DESC LIMIT 1;
  IF FOUND THEN RETURN a; END IF;

  INSERT INTO public.attempts (user_id, exam_id, mode, started_at, expires_at)
  VALUES (
    uid, _exam_id, _mode, now(),
    CASE WHEN _mode = 'timed'
      THEN now() + make_interval(mins => e.time_limit_minutes) END
  )
  RETURNING * INTO a;
  RETURN a;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_attempt(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_attempt(uuid, text) TO authenticated;

-- Direct client inserts are no longer allowed.
REVOKE INSERT ON public.attempts FROM authenticated;
DROP POLICY IF EXISTS attempts_insert_own ON public.attempts;

-- 4. Server-authoritative remaining time.
CREATE OR REPLACE FUNCTION public.get_attempt_time_remaining(_attempt_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN a.expires_at IS NULL THEN NULL
    ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (a.expires_at - now())))::integer)
  END
  FROM public.attempts a
  WHERE a.id = _attempt_id AND a.user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_attempt_time_remaining(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_time_remaining(uuid) TO authenticated;

-- 5. Cancelling after the clock runs out would dodge a failing score.
CREATE OR REPLACE FUNCTION public.cancel_attempt(_attempt_id uuid)
RETURNS public.attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.attempts;
BEGIN
  SELECT * INTO a FROM public.attempts WHERE id = _attempt_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.status <> 'in_progress' THEN RETURN a; END IF;
  IF a.expires_at IS NOT NULL AND a.expires_at <= now() THEN
    RAISE EXCEPTION 'Time has expired; this attempt must be submitted';
  END IF;

  UPDATE public.attempts
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = _attempt_id AND user_id = auth.uid() AND status = 'in_progress'
  RETURNING * INTO a;
  RETURN a;
END;
$$;

-- 6. Duration is clamped to the exam's own limit.
CREATE OR REPLACE FUNCTION public.submit_attempt(_attempt_id uuid)
RETURNS public.attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  RETURN a;
END;
$$;

-- 7. No explanations while a retake of the same exam is live.
CREATE OR REPLACE FUNCTION public.get_question_explanations(_question_ids uuid[])
RETURNS TABLE(question_id uuid, explanation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT q.id, q.explanation
  FROM public.questions q
  WHERE q.id = ANY(_question_ids)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        EXISTS (
          SELECT 1
          FROM public.exam_questions eq
          JOIN public.attempts a ON a.exam_id = eq.exam_id
          WHERE eq.question_id = q.id
            AND a.user_id = auth.uid()
            AND a.status = 'submitted'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.exam_questions eq2
          JOIN public.attempts a2 ON a2.exam_id = eq2.exam_id
          WHERE eq2.question_id = q.id
            AND a2.user_id = auth.uid()
            AND a2.status = 'in_progress'
        )
      )
    )
$$;

-- 8. Remove the attempt row created during this audit's attack testing.
DELETE FROM public.attempts WHERE id = '4c6b715f-5f94-4c5c-9b6d-4507284a71f9';