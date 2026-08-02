-- Internal helper: only other security-definer routines should call it.
REVOKE EXECUTE ON FUNCTION public.attempt_item_set(uuid) FROM authenticated;

-- ============================================================
-- Case studies
-- ============================================================

CREATE TABLE public.case_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id uuid NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  title text NOT NULL,
  organization_overview text,
  existing_environment text,
  business_requirements text,
  technical_requirements text,
  security_requirements text,
  constraints text,
  exhibits jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_studies_title_not_blank CHECK (length(btrim(title)) >= 3)
);
ALTER TABLE public.questions
  ADD COLUMN case_study_id uuid REFERENCES public.case_studies(id) ON DELETE SET NULL;
CREATE INDEX questions_case_study_idx ON public.questions (case_study_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_studies TO authenticated;
GRANT ALL ON public.case_studies TO service_role;
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;

-- Students only see a case study that is part of one of their own attempts.
CREATE POLICY "Students read case studies in their attempts" ON public.case_studies
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.attempt_questions aq
      JOIN public.attempts a ON a.id = aq.attempt_id
      JOIN public.questions q ON q.id = aq.question_id
      WHERE a.user_id = auth.uid() AND q.case_study_id = case_studies.id
    )
  );
CREATE POLICY "Admins manage case studies" ON public.case_studies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER case_studies_set_updated_at
  BEFORE UPDATE ON public.case_studies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.questions DROP CONSTRAINT questions_type_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_type_check CHECK (
  question_type IN (
    'single_choice',
    'multiple_choice',
    'scenario_single_choice',
    'scenario_multiple_choice',
    'yes_no'
  )
);

-- Case-study text travels with the exam payload so it stays on screen while
-- the linked questions are answered. No answer-key data is included.
CREATE OR REPLACE FUNCTION public.get_attempt_case_studies(_attempt_id uuid)
RETURNS TABLE(id uuid, title text, organization_overview text, existing_environment text,
              business_requirements text, technical_requirements text,
              security_requirements text, constraints text, exhibits jsonb,
              question_ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    cs.id,
    cs.title,
    cs.organization_overview,
    cs.existing_environment,
    cs.business_requirements,
    cs.technical_requirements,
    cs.security_requirements,
    cs.constraints,
    cs.exhibits,
    array_agg(aq.question_id ORDER BY aq.position)
  FROM public.attempts a
  JOIN public.attempt_questions aq ON aq.attempt_id = a.id
  JOIN public.questions q ON q.id = aq.question_id
  JOIN public.case_studies cs ON cs.id = q.case_study_id
  WHERE a.id = _attempt_id
    AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  GROUP BY cs.id
$$;

REVOKE ALL ON FUNCTION public.get_attempt_case_studies(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_attempt_case_studies(uuid) TO authenticated, service_role;

-- ============================================================
-- Admin readiness reporting
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_question_bank_readiness(_certification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  WITH q AS (
    SELECT qq.*, d.id AS domain_id, d.name AS domain_name, d.sort_order AS domain_sort,
           t.name AS topic_name
    FROM public.questions qq
    LEFT JOIN public.topics t ON t.id = qq.topic_id
    LEFT JOIN public.domains d ON d.id = t.domain_id
    WHERE qq.certification_id = _certification_id AND NOT qq.is_archived
  ),
  approved AS (SELECT * FROM q WHERE governance_status = 'approved' AND is_active)
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM q),
    'approved', (SELECT COUNT(*) FROM approved),
    'awaiting_review', (SELECT COUNT(*) FROM q WHERE governance_status <> 'approved'),
    'flagged_duplicates', (SELECT COUNT(*) FROM q WHERE review_flag),
    'missing_explanation', (SELECT COUNT(*) FROM q WHERE explanation IS NULL OR btrim(explanation) = ''),
    'missing_metadata', (SELECT COUNT(*) FROM q WHERE topic_id IS NULL),
    'by_domain', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', COALESCE(x.domain_name, 'Unassigned'), 'approved', x.n)
             ORDER BY COALESCE(x.domain_sort, 9999))
      FROM (SELECT domain_name, domain_sort, COUNT(*)::int AS n FROM approved
            GROUP BY domain_name, domain_sort) x
    ), '[]'::jsonb),
    'by_topic', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', COALESCE(x.topic_name, 'Unassigned'), 'approved', x.n)
             ORDER BY x.n DESC)
      FROM (SELECT topic_name, COUNT(*)::int AS n FROM approved GROUP BY topic_name) x
    ), '[]'::jsonb),
    'by_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', x.question_type, 'approved', x.n) ORDER BY x.question_type)
      FROM (SELECT question_type, COUNT(*)::int AS n FROM approved GROUP BY question_type) x
    ), '[]'::jsonb),
    'by_difficulty', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', x.difficulty, 'approved', x.n) ORDER BY x.difficulty)
      FROM (SELECT difficulty, COUNT(*)::int AS n FROM approved GROUP BY difficulty) x
    ), '[]'::jsonb),
    -- Content-pool estimate only: how many 50-question sittings the approved
    -- pool could cover without reusing an item. Not an infrastructure limit.
    'non_repeating_50q_attempts', FLOOR((SELECT COUNT(*) FROM approved) / 50.0)::int,
    'estimate_note', 'Content-pool estimate: approved questions divided by 50. It is not a capacity or infrastructure figure.'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_question_bank_readiness(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_question_bank_readiness(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_blueprint_readiness(_blueprint_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  b public.exam_blueprints;
  v_domains jsonb := '[]'::jsonb;
  v_ok boolean := true;
  r record;
  v_available integer;
  v_total_available integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT * INTO b FROM public.exam_blueprints WHERE id = _blueprint_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Blueprint not found'; END IF;

  SELECT COUNT(*)::int INTO v_total_available
  FROM public.questions q
  WHERE q.certification_id = b.certification_id
    AND q.is_active AND NOT q.is_archived
    AND q.governance_status = 'approved'
    AND q.question_type = ANY (b.allowed_question_types)
    AND EXISTS (SELECT 1 FROM public.question_options o WHERE o.question_id = q.id AND o.is_correct);

  FOR r IN
    SELECT bd.domain_id, d.name,
           CEIL(b.max_question_count * bd.min_percent / 100.0)::int AS required
    FROM public.exam_blueprint_domains bd
    JOIN public.domains d ON d.id = bd.domain_id
    WHERE bd.blueprint_id = _blueprint_id
    ORDER BY bd.sort_order
  LOOP
    SELECT COUNT(*)::int INTO v_available
    FROM public.questions q
    JOIN public.topics t ON t.id = q.topic_id
    WHERE t.domain_id = r.domain_id
      AND q.is_active AND NOT q.is_archived
      AND q.governance_status = 'approved'
      AND q.question_type = ANY (b.allowed_question_types)
      AND EXISTS (SELECT 1 FROM public.question_options o WHERE o.question_id = q.id AND o.is_correct);

    IF v_available < r.required THEN v_ok := false; END IF;

    v_domains := v_domains || jsonb_build_object(
      'domain_id', r.domain_id,
      'name', r.name,
      'required', r.required,
      'available', v_available,
      'satisfied', v_available >= r.required
    );
  END LOOP;

  IF v_total_available < b.max_question_count THEN v_ok := false; END IF;

  RETURN jsonb_build_object(
    'blueprint_id', _blueprint_id,
    'satisfiable', v_ok,
    'total_available', v_total_available,
    'max_question_count', b.max_question_count,
    'default_question_count', b.default_question_count,
    'domains', v_domains
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_blueprint_readiness(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_blueprint_readiness(uuid) TO authenticated, service_role;

-- ============================================================
-- Publication guard + blueprint auditing
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_blueprint_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_readiness jsonb;
BEGIN
  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.is_published, false)) THEN
    IF NOT EXISTS (SELECT 1 FROM public.exam_blueprint_domains WHERE blueprint_id = NEW.id) THEN
      RAISE EXCEPTION 'Add at least one skill area before publishing this blueprint';
    END IF;
    v_readiness := public.get_blueprint_readiness(NEW.id);
    IF NOT (v_readiness ->> 'satisfiable')::boolean THEN
      RAISE EXCEPTION 'The question bank cannot satisfy this blueprint yet: %', v_readiness ->> 'domains';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER exam_blueprints_publication_guard
  BEFORE UPDATE ON public.exam_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.guard_blueprint_publication();

CREATE OR REPLACE FUNCTION public.audit_blueprint_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (
    auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'blueprint.created'
      WHEN TG_OP = 'DELETE' THEN 'blueprint.deleted'
      WHEN NEW.is_published AND NOT OLD.is_published THEN 'blueprint.published'
      WHEN NOT NEW.is_published AND OLD.is_published THEN 'blueprint.unpublished'
      ELSE 'blueprint.updated'
    END,
    'exam_blueprint',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.name, OLD.name),
    jsonb_build_object(
      'scoring_model_version', COALESCE(NEW.scoring_model_version, OLD.scoring_model_version),
      'default_question_count', COALESCE(NEW.default_question_count, OLD.default_question_count),
      'duration_minutes', COALESCE(NEW.duration_minutes, OLD.duration_minutes),
      'passing_scaled_score', COALESCE(NEW.passing_scaled_score, OLD.passing_scaled_score)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER exam_blueprints_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.audit_blueprint_change();