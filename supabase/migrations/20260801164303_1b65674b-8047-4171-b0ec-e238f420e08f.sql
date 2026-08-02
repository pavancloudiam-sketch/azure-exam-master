-- ============================================================
-- AUDIT FIX 1: explanation text leaked to students mid-exam
-- ============================================================
-- `questions.explanation` was readable by any student who had an attempt on
-- the exam, straight from the Data API, before submitting. Column-level SELECT
-- is now removed and explanations are served by a gated function instead.
REVOKE SELECT ON public.questions FROM authenticated;
GRANT SELECT (
  id, exam_id, topic_id, stem, question_type, sort_order,
  created_at, updated_at, certification_id, scenario,
  difficulty, points, is_active
) ON public.questions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_question_explanations(_question_ids uuid[])
RETURNS TABLE(question_id uuid, explanation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.explanation
  FROM public.questions q
  WHERE q.id = ANY(_question_ids)
    AND (
      public.has_role(auth.uid(), 'admin')
      -- a student may see the explanation only for questions belonging to an
      -- attempt they have already SUBMITTED (never during an active attempt)
      OR EXISTS (
        SELECT 1
        FROM public.exam_questions eq
        JOIN public.attempts a ON a.exam_id = eq.exam_id
        WHERE eq.question_id = q.id
          AND a.user_id = auth.uid()
          AND a.status = 'submitted'
      )
    )
$$;

REVOKE ALL ON FUNCTION public.get_question_explanations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_question_explanations(uuid[]) TO authenticated, service_role;

-- ============================================================
-- AUDIT FIX 2: anon held ALL privileges on every public table
-- ============================================================
-- No policy targets `anon`, so RLS already denied everything, but the grants
-- themselves were far wider than intended. Remove them (defence in depth).
REVOKE ALL ON public.attempt_answers  FROM anon;
REVOKE ALL ON public.attempts         FROM anon;
REVOKE ALL ON public.audit_logs       FROM anon;
REVOKE ALL ON public.certifications   FROM anon;
REVOKE ALL ON public.domains          FROM anon;
REVOKE ALL ON public.exam_questions   FROM anon;
REVOKE ALL ON public.exams            FROM anon;
REVOKE ALL ON public.profiles         FROM anon;
REVOKE ALL ON public.question_options FROM anon;
REVOKE ALL ON public.questions        FROM anon;
REVOKE ALL ON public.topics           FROM anon;
REVOKE ALL ON public.user_roles       FROM anon;