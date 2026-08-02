ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS allow_timed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_practice boolean NOT NULL DEFAULT true;

ALTER TABLE public.exams
  ADD CONSTRAINT exams_passing_score_range CHECK (passing_score BETWEEN 1 AND 1000),
  ADD CONSTRAINT exams_question_count_range CHECK (question_count BETWEEN 0 AND 500),
  ADD CONSTRAINT exams_time_limit_range CHECK (time_limit_minutes IS NULL OR time_limit_minutes BETWEEN 1 AND 600),
  ADD CONSTRAINT exams_mode_selected CHECK (allow_timed OR allow_practice),
  ADD CONSTRAINT exams_title_not_blank CHECK (length(btrim(title)) >= 3);

CREATE OR REPLACE FUNCTION public.exam_is_available(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = _exam_id
      AND e.is_active
      AND e.is_published
      AND e.question_count > 0
      AND (e.allow_timed OR e.allow_practice)
      AND (NOT e.allow_timed OR e.time_limit_minutes IS NOT NULL)
      AND EXISTS (
        SELECT 1
        FROM public.exam_questions eq
        JOIN public.questions q ON q.id = eq.question_id
        WHERE eq.exam_id = e.id AND q.is_active AND NOT q.is_archived
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.exam_is_available(uuid) TO authenticated;

DROP POLICY IF EXISTS "exams_read_published" ON public.exams;
CREATE POLICY "exams_read_available" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.exam_is_available(id)
    OR EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.exam_id = exams.id AND a.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.start_attempt(_exam_id uuid, _mode text)
 RETURNS attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a public.attempts;
  e public.exams;
  c public.certifications;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _mode NOT IN ('timed', 'practice') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  SELECT * INTO e FROM public.exams WHERE id = _exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;

  IF NOT public.exam_is_available(_exam_id) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Exam is not available';
  END IF;

  IF _mode = 'timed' AND NOT e.allow_timed THEN
    RAISE EXCEPTION 'Timed mode is not enabled for this exam';
  END IF;
  IF _mode = 'practice' AND NOT e.allow_practice THEN
    RAISE EXCEPTION 'Practice mode is not enabled for this exam';
  END IF;

  SELECT * INTO c FROM public.certifications WHERE id = e.certification_id;
  IF c.lifecycle_status = 'retired' AND NOT c.allow_new_attempts THEN
    RAISE EXCEPTION 'This certification version is retired and is not accepting new attempts';
  END IF;

  IF _mode = 'timed' AND e.time_limit_minutes IS NULL THEN
    RAISE EXCEPTION 'This exam has no time limit configured';
  END IF;

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
$function$;