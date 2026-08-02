CREATE TABLE public.ai_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Mock interview',
  topic text NOT NULL,
  difficulty text NOT NULL,
  style text NOT NULL,
  planned_questions integer NOT NULL DEFAULT 5,
  questions_asked integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'saved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_interview_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_interview_sessions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_interview_turns_role_check CHECK (role IN ('user','assistant'))
);

CREATE INDEX idx_ai_interview_sessions_user ON public.ai_interview_sessions (user_id, created_at DESC);
CREATE INDEX idx_ai_interview_turns_session ON public.ai_interview_turns (session_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_interview_sessions TO authenticated;
GRANT ALL ON public.ai_interview_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_interview_turns TO authenticated;
GRANT ALL ON public.ai_interview_turns TO service_role;

ALTER TABLE public.ai_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interview_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own interview sessions"
  ON public.ai_interview_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can review interview sessions"
  ON public.ai_interview_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students manage their own interview turns"
  ON public.ai_interview_turns FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_interview_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_interview_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Admins can review interview turns"
  ON public.ai_interview_turns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_ai_interview_sessions_updated_at
  BEFORE UPDATE ON public.ai_interview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();