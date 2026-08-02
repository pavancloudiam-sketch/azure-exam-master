-- 1. Extend questions into a reusable bank
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS certification_id uuid REFERENCES public.certifications(id),
  ADD COLUMN IF NOT EXISTS scenario text,
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.questions q
SET certification_id = e.certification_id
FROM public.exams e
WHERE e.id = q.exam_id AND q.certification_id IS NULL;

ALTER TABLE public.questions ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN certification_id SET NOT NULL;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_difficulty_check CHECK (difficulty IN ('easy','medium','hard')),
  ADD CONSTRAINT questions_points_check CHECK (points > 0),
  ADD CONSTRAINT questions_type_check CHECK (question_type IN ('single_choice','multiple_choice','scenario_single_choice','scenario_multiple_choice'));

DROP TRIGGER IF EXISTS questions_set_updated_at ON public.questions;
CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE DELETE ON public.questions FROM authenticated;
REVOKE DELETE ON public.question_options FROM authenticated;

-- 2. Exam <-> question assignments
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id),
  question_id uuid NOT NULL REFERENCES public.questions(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_questions_admin_write ON public.exam_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY exam_questions_read_own_attempts ON public.exam_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attempts a
    WHERE a.exam_id = exam_questions.exam_id AND a.user_id = auth.uid()
  ));

-- backfill assignments from the legacy direct exam link
INSERT INTO public.exam_questions (exam_id, question_id, sort_order)
SELECT q.exam_id, q.id, q.sort_order
FROM public.questions q
WHERE q.exam_id IS NOT NULL
ON CONFLICT (exam_id, question_id) DO NOTHING;

-- 3. Student reads follow assignments; historical attempts keep access
DROP POLICY IF EXISTS questions_read ON public.questions;
CREATE POLICY questions_read ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.exam_questions eq
      JOIN public.attempts a ON a.exam_id = eq.exam_id
      WHERE eq.question_id = questions.id AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.exam_id = questions.exam_id AND a.user_id = auth.uid()
    )
  );

-- 4. Option reads keep hiding is_correct from students
CREATE OR REPLACE FUNCTION public.get_question_options(_question_id uuid)
 RETURNS TABLE(id uuid, question_id uuid, label text, content text, sort_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.question_id, o.label, o.content, o.sort_order
  FROM public.question_options o
  JOIN public.questions q ON q.id = o.question_id
  WHERE o.question_id = _question_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.exam_questions eq
        JOIN public.attempts a ON a.exam_id = eq.exam_id
        WHERE eq.question_id = q.id AND a.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.attempts a
        WHERE a.exam_id = q.exam_id AND a.user_id = auth.uid()
      )
    )
  ORDER BY o.sort_order
$function$;