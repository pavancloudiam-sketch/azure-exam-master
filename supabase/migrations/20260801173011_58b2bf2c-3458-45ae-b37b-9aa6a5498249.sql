ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS governance_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_governance_status_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_governance_status_check
  CHECK (governance_status IN ('draft','technical_review','language_review','approved'));

CREATE INDEX IF NOT EXISTS questions_tags_idx ON public.questions USING gin (tags);
CREATE INDEX IF NOT EXISTS questions_governance_status_idx ON public.questions (governance_status);
CREATE INDEX IF NOT EXISTS questions_topic_idx ON public.questions (topic_id);
CREATE INDEX IF NOT EXISTS questions_certification_idx ON public.questions (certification_id);
CREATE INDEX IF NOT EXISTS questions_import_batch_idx ON public.questions (import_batch_id);
CREATE INDEX IF NOT EXISTS exam_questions_question_idx ON public.exam_questions (question_id);
CREATE INDEX IF NOT EXISTS attempt_answers_question_idx ON public.attempt_answers (question_id);
CREATE INDEX IF NOT EXISTS attempts_exam_status_idx ON public.attempts (exam_id, status);

-- Append tags to many questions in one statement (admins only).
CREATE OR REPLACE FUNCTION public.bulk_add_question_tags(_question_ids uuid[], _tags text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE affected integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.questions q
  SET tags = (
    SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}'::text[])
    FROM unnest(q.tags || _tags) AS t
    WHERE btrim(t) <> ''
  )
  WHERE q.id = ANY(_question_ids);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_add_question_tags(uuid[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_add_question_tags(uuid[], text[]) TO authenticated;

-- Descriptive usage statistics. Never used to mutate content automatically.
CREATE OR REPLACE FUNCTION public.get_question_stats(_question_ids uuid[])
RETURNS TABLE(
  question_id uuid,
  usage_count integer,
  attempt_count integer,
  correct_count integer,
  pass_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ids AS (
    SELECT unnest(_question_ids) AS qid
    WHERE public.has_role(auth.uid(), 'admin')
  ),
  usage AS (
    SELECT eq.question_id AS qid, COUNT(DISTINCT eq.exam_id)::int AS n
    FROM public.exam_questions eq
    JOIN public.exams e ON e.id = eq.exam_id AND e.is_published
    WHERE eq.question_id = ANY(_question_ids)
    GROUP BY eq.question_id
  ),
  delivered AS (
    SELECT eq.question_id AS qid, a.id AS attempt_id
    FROM public.exam_questions eq
    JOIN public.attempts a ON a.exam_id = eq.exam_id AND a.status = 'submitted'
    WHERE eq.question_id = ANY(_question_ids)
  ),
  answered AS (
    SELECT d.qid,
      COUNT(*)::int AS attempts,
      COUNT(*) FILTER (WHERE ans.is_correct)::int AS correct
    FROM delivered d
    LEFT JOIN public.attempt_answers ans
      ON ans.attempt_id = d.attempt_id AND ans.question_id = d.qid
    GROUP BY d.qid
  )
  SELECT
    ids.qid,
    COALESCE(usage.n, 0),
    COALESCE(answered.attempts, 0),
    COALESCE(answered.correct, 0),
    CASE WHEN COALESCE(answered.attempts, 0) > 0
      THEN ROUND((answered.correct::numeric / answered.attempts::numeric) * 100, 1)
      ELSE NULL END
  FROM ids
  LEFT JOIN usage ON usage.qid = ids.qid
  LEFT JOIN answered ON answered.qid = ids.qid
$$;

REVOKE ALL ON FUNCTION public.get_question_stats(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_question_stats(uuid[]) TO authenticated;