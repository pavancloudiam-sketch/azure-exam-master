CREATE TABLE public.ai_feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_feature_flags TO authenticated;
GRANT ALL ON public.ai_feature_flags TO service_role;
ALTER TABLE public.ai_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read AI flags"
ON public.ai_feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update AI flags"
ON public.ai_feature_flags FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'ok',
  error_code text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  request_id text,
  attempt_id uuid REFERENCES public.attempts(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own AI usage"
ON public.ai_usage_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX ai_usage_logs_user_feature_created_idx
  ON public.ai_usage_logs (user_id, feature, created_at DESC);
CREATE INDEX ai_usage_logs_created_idx ON public.ai_usage_logs (created_at DESC);

CREATE TRIGGER ai_feature_flags_updated_at
BEFORE UPDATE ON public.ai_feature_flags
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_feature_flags (key, label, description, is_enabled) VALUES
  ('ai_coach', 'AskMe AI Coach', 'Post-exam explanations and coaching on submitted attempts.', false),
  ('ai_study_assistant', 'AI Study Assistant', 'Concept explanations, revision notes and study plans.', false),
  ('ai_performance_coach', 'AI Performance Coach', 'Guidance derived from the student''s own submitted attempts.', false),
  ('ai_interview_coach', 'AI Interview Coach', 'Practice interview questions and constructive feedback.', false),
  ('ai_question_generator', 'Admin AI Question Generator', 'Admin-only drafting of original practice questions for review.', false);