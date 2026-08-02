CREATE TABLE public.ai_content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  attempt_id uuid REFERENCES public.attempts(id) ON DELETE SET NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  request_id text,
  reason text NOT NULL,
  note text,
  reported_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_content_reports_status_idx ON public.ai_content_reports (status, created_at DESC);
CREATE INDEX ai_content_reports_user_idx ON public.ai_content_reports (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_content_reports TO authenticated;
GRANT ALL ON public.ai_content_reports TO service_role;

ALTER TABLE public.ai_content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own AI reports"
ON public.ai_content_reports FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read their own AI reports"
ON public.ai_content_reports FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins review AI reports"
ON public.ai_content_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));