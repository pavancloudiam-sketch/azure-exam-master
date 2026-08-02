
create or replace function public.start_attempt(_exam_id uuid, _mode text, _question_count integer default null::integer, _domain_id uuid default null::uuid)
 returns attempts
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  a public.attempts;
  e public.exams;
  c public.certifications;
  b public.exam_blueprints;
  uid uuid := auth.uid();
  v_total integer;
  v_minutes integer;
  v_snapshot jsonb := '{}'::jsonb;
  v_timed boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _mode NOT IN ('timed', 'practice', 'realistic_mock', 'domain_practice', 'revision') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;

  SELECT * INTO e FROM public.exams WHERE id = _exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;

  IF NOT public.exam_is_available(_exam_id) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Exam is not available';
  END IF;

  -- Paid exams are gated on a verified purchase (entitlement), never on the browser.
  IF public.exam_requires_purchase(_exam_id)
     AND NOT public.has_exam_access(uid, _exam_id)
     AND NOT public.has_org_exam_access(uid, _exam_id)
     AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'This exam requires a purchase';
  END IF;

  SELECT * INTO c FROM public.certifications WHERE id = e.certification_id;
  IF c.lifecycle_status = 'retired' AND NOT c.allow_new_attempts THEN
    RAISE EXCEPTION 'This certification version is retired and is not accepting new attempts';
  END IF;

  IF e.blueprint_id IS NOT NULL THEN
    SELECT * INTO b FROM public.exam_blueprints WHERE id = e.blueprint_id;
  END IF;

  v_timed := _mode IN ('timed', 'realistic_mock');

  IF b.id IS NULL THEN
    IF _mode NOT IN ('timed', 'practice') THEN
      RAISE EXCEPTION 'This exam does not support the % mode', _mode;
    END IF;
    IF _mode = 'timed' AND NOT e.allow_timed THEN
      RAISE EXCEPTION 'Timed mode is not enabled for this exam';
    END IF;
    IF _mode = 'practice' AND NOT e.allow_practice THEN
      RAISE EXCEPTION 'Practice mode is not enabled for this exam';
    END IF;
    IF _mode = 'timed' AND e.time_limit_minutes IS NULL THEN
      RAISE EXCEPTION 'This exam has no time limit configured';
    END IF;
    v_minutes := CASE WHEN _mode = 'timed' THEN e.time_limit_minutes END;
  ELSE
    IF NOT b.is_published AND NOT public.has_role(uid, 'admin') THEN
      RAISE EXCEPTION 'This exam blueprint is not published';
    END IF;
    v_total := LEAST(
      GREATEST(COALESCE(_question_count, b.default_question_count), b.min_question_count),
      b.max_question_count
    );
    v_minutes := CASE WHEN v_timed THEN COALESCE(b.duration_minutes, e.time_limit_minutes) END;
    IF v_timed AND v_minutes IS NULL THEN
      RAISE EXCEPTION 'This exam has no time limit configured';
    END IF;
  END IF;

  SELECT * INTO a FROM public.attempts
  WHERE user_id = uid AND exam_id = _exam_id AND status = 'in_progress'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY started_at DESC LIMIT 1;
  IF FOUND THEN RETURN a; END IF;

  INSERT INTO public.attempts (
    user_id, exam_id, mode, started_at, expires_at, blueprint_id, scoring_model_version
  )
  VALUES (
    uid, _exam_id, _mode, now(),
    CASE WHEN v_minutes IS NOT NULL THEN now() + make_interval(mins => v_minutes) END,
    b.id,
    COALESCE(b.scoring_model_version, 'v1')
  )
  RETURNING * INTO a;

  IF b.id IS NOT NULL THEN
    v_snapshot := public.select_attempt_questions(a.id, b.id, v_total, _domain_id);

    IF (v_snapshot ->> 'selected_total')::int = 0 THEN
      RAISE EXCEPTION 'No approved questions are available for this exam yet';
    END IF;

    UPDATE public.attempts SET
      blueprint_snapshot = v_snapshot,
      pilot_count = (v_snapshot ->> 'pilot_count')::int,
      scored_count = (v_snapshot ->> 'selected_total')::int - (v_snapshot ->> 'pilot_count')::int
    WHERE id = a.id
    RETURNING * INTO a;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
    VALUES (uid, 'attempt.questions_selected', 'attempt', a.id, e.title, v_snapshot);
  END IF;

  RETURN a;
END;
$function$;
