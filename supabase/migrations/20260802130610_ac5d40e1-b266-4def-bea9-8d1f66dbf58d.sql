-- ============================================================
-- Phase 1: blueprint model + per-attempt frozen question set
-- ============================================================

CREATE TABLE public.scoring_models (
  version text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  formula text NOT NULL,
  min_scaled_score integer NOT NULL DEFAULT 1,
  max_scaled_score integer NOT NULL DEFAULT 1000,
  default_threshold integer NOT NULL DEFAULT 700,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scoring_models TO authenticated, anon;
GRANT ALL ON public.scoring_models TO service_role;
ALTER TABLE public.scoring_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoring models are readable" ON public.scoring_models
  FOR SELECT USING (true);
CREATE POLICY "Admins manage scoring models" ON public.scoring_models
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.scoring_models (version, label, description, formula)
VALUES (
  'v1',
  'AskMeExam Practice Scaled Score v1',
  'Deterministic linear conversion of earned weighted points into a 1-1000 practice scaled score. This is an AskMeExam model and does not reproduce Microsoft''s official scaled-score calculation.',
  'round(1 + (earned_weighted_points / available_weighted_points) * 999)'
);

-- ------------------------------------------------------------

CREATE TABLE public.exam_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id uuid NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'realistic_mock'
    CHECK (mode IN ('realistic_mock', 'practice', 'domain_practice', 'revision')),
  duration_minutes integer CHECK (duration_minutes IS NULL OR (duration_minutes BETWEEN 1 AND 600)),
  default_question_count integer NOT NULL DEFAULT 50 CHECK (default_question_count BETWEEN 1 AND 500),
  min_question_count integer NOT NULL DEFAULT 35 CHECK (min_question_count BETWEEN 1 AND 500),
  max_question_count integer NOT NULL DEFAULT 60 CHECK (max_question_count BETWEEN 1 AND 500),
  passing_scaled_score integer NOT NULL DEFAULT 700 CHECK (passing_scaled_score BETWEEN 1 AND 1000),
  scoring_model_version text NOT NULL DEFAULT 'v1' REFERENCES public.scoring_models(version),
  randomize_questions boolean NOT NULL DEFAULT true,
  randomize_options boolean NOT NULL DEFAULT true,
  allow_partial_credit boolean NOT NULL DEFAULT true,
  allowed_question_types text[] NOT NULL DEFAULT ARRAY['single_choice','multiple_choice','scenario_single_choice','scenario_multiple_choice']::text[],
  difficulty_distribution jsonb NOT NULL DEFAULT '{"easy": 30, "medium": 50, "hard": 20}'::jsonb,
  case_study_count integer NOT NULL DEFAULT 0 CHECK (case_study_count >= 0),
  allow_case_study_return boolean NOT NULL DEFAULT true,
  pilot_question_count integer NOT NULL DEFAULT 0 CHECK (pilot_question_count >= 0),
  repetition_cooldown_days integer NOT NULL DEFAULT 90 CHECK (repetition_cooldown_days >= 0),
  max_repeat_count integer NOT NULL DEFAULT 3 CHECK (max_repeat_count >= 1),
  allow_repeats boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_blueprints_count_range CHECK (
    min_question_count <= default_question_count
    AND default_question_count <= max_question_count
  ),
  CONSTRAINT exam_blueprints_name_not_blank CHECK (length(btrim(name)) >= 3)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_blueprints TO authenticated;
GRANT ALL ON public.exam_blueprints TO service_role;
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read published blueprints" ON public.exam_blueprints
  FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage blueprints" ON public.exam_blueprints
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER exam_blueprints_set_updated_at
  BEFORE UPDATE ON public.exam_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------

CREATE TABLE public.exam_blueprint_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.exam_blueprints(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  min_percent numeric(5,2) NOT NULL CHECK (min_percent >= 0 AND min_percent <= 100),
  max_percent numeric(5,2) NOT NULL CHECK (max_percent >= 0 AND max_percent <= 100),
  topic_quotas jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, domain_id),
  CONSTRAINT blueprint_domain_percent_range CHECK (min_percent <= max_percent)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_blueprint_domains TO authenticated;
GRANT ALL ON public.exam_blueprint_domains TO service_role;
ALTER TABLE public.exam_blueprint_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read blueprint domains" ON public.exam_blueprint_domains
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exam_blueprints b
    WHERE b.id = blueprint_id AND (b.is_published OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Admins manage blueprint domains" ON public.exam_blueprint_domains
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER exam_blueprint_domains_set_updated_at
  BEFORE UPDATE ON public.exam_blueprint_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------

ALTER TABLE public.exams
  ADD COLUMN blueprint_id uuid REFERENCES public.exam_blueprints(id) ON DELETE SET NULL;

ALTER TABLE public.questions
  ADD COLUMN scoring_method text NOT NULL DEFAULT 'all_or_nothing'
    CHECK (scoring_method IN ('all_or_nothing', 'partial_credit')),
  ADD COLUMN is_pilot_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN source_page text;

ALTER TABLE public.attempts
  ADD COLUMN blueprint_id uuid REFERENCES public.exam_blueprints(id) ON DELETE SET NULL,
  ADD COLUMN scoring_model_version text REFERENCES public.scoring_models(version),
  ADD COLUMN earned_points numeric(8,2),
  ADD COLUMN available_points numeric(8,2),
  ADD COLUMN pilot_count integer NOT NULL DEFAULT 0,
  ADD COLUMN scored_count integer NOT NULL DEFAULT 0,
  ADD COLUMN blueprint_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.attempts DROP CONSTRAINT attempts_mode_check;
ALTER TABLE public.attempts ADD CONSTRAINT attempts_mode_check
  CHECK (mode IN ('timed', 'practice', 'realistic_mock', 'domain_practice', 'revision'));

ALTER TABLE public.attempt_answers
  ADD COLUMN earned_points numeric(6,2);

-- ------------------------------------------------------------

CREATE TABLE public.attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  option_order uuid[] NOT NULL DEFAULT '{}'::uuid[],
  is_pilot boolean NOT NULL DEFAULT false,
  points integer NOT NULL DEFAULT 1,
  scoring_method text NOT NULL DEFAULT 'all_or_nothing',
  domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id),
  UNIQUE (attempt_id, position)
);
CREATE INDEX attempt_questions_attempt_idx ON public.attempt_questions (attempt_id, position);
GRANT SELECT ON public.attempt_questions TO authenticated;
GRANT ALL ON public.attempt_questions TO service_role;
ALTER TABLE public.attempt_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own attempt question set" ON public.attempt_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- ------------------------------------------------------------

CREATE TABLE public.question_exposure (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  times_presented integer NOT NULL DEFAULT 0,
  first_presented_at timestamptz NOT NULL DEFAULT now(),
  last_presented_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_id uuid REFERENCES public.attempts(id) ON DELETE SET NULL,
  last_result text,
  last_time_spent_seconds integer,
  last_marked_for_review boolean NOT NULL DEFAULT false,
  attempt_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX question_exposure_user_last_idx
  ON public.question_exposure (user_id, last_presented_at DESC);
GRANT SELECT ON public.question_exposure TO authenticated;
GRANT ALL ON public.question_exposure TO service_role;
ALTER TABLE public.question_exposure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own exposure history" ON public.question_exposure
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Blueprint allocation: largest-remainder within min/max ranges
-- ============================================================

CREATE OR REPLACE FUNCTION public.allocate_blueprint_domains(
  _blueprint_id uuid,
  _total integer
)
RETURNS TABLE(domain_id uuid, target integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_assigned integer := 0;
  v_remaining integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _alloc (
    domain_id uuid PRIMARY KEY,
    target integer,
    remainder numeric,
    lo integer,
    hi integer
  ) ON COMMIT DROP;
  DELETE FROM _alloc;

  FOR r IN
    SELECT bd.domain_id AS did,
           FLOOR(_total * bd.min_percent / 100.0)::int AS lo,
           CEIL(_total * bd.max_percent / 100.0)::int AS hi,
           (_total * (bd.min_percent + bd.max_percent) / 200.0) AS ideal
    FROM public.exam_blueprint_domains bd
    WHERE bd.blueprint_id = _blueprint_id
    ORDER BY bd.sort_order, bd.domain_id
  LOOP
    INSERT INTO _alloc (domain_id, target, remainder, lo, hi)
    VALUES (r.did, FLOOR(r.ideal)::int, r.ideal - FLOOR(r.ideal), r.lo, r.hi);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM _alloc) THEN
    RETURN;
  END IF;

  UPDATE _alloc SET target = GREATEST(target, lo);
  UPDATE _alloc SET target = LEAST(target, hi);

  SELECT COALESCE(SUM(a.target), 0) INTO v_assigned FROM _alloc a;
  v_remaining := _total - v_assigned;

  -- Distribute the shortfall to the largest fractional remainders that still
  -- have headroom; take the surplus back from the smallest remainders.
  WHILE v_remaining > 0 LOOP
    UPDATE _alloc SET target = target + 1
    WHERE _alloc.domain_id = (
      SELECT a.domain_id FROM _alloc a WHERE a.target < a.hi
      ORDER BY a.remainder DESC, a.target ASC, a.domain_id LIMIT 1
    );
    IF NOT FOUND THEN
      UPDATE _alloc SET target = target + 1
      WHERE _alloc.domain_id = (
        SELECT a.domain_id FROM _alloc a ORDER BY a.target ASC, a.domain_id LIMIT 1
      );
    END IF;
    v_remaining := v_remaining - 1;
  END LOOP;

  WHILE v_remaining < 0 LOOP
    UPDATE _alloc SET target = target - 1
    WHERE _alloc.domain_id = (
      SELECT a.domain_id FROM _alloc a WHERE a.target > a.lo AND a.target > 0
      ORDER BY a.remainder ASC, a.target DESC, a.domain_id LIMIT 1
    );
    IF NOT FOUND THEN
      UPDATE _alloc SET target = target - 1
      WHERE _alloc.domain_id = (
        SELECT a.domain_id FROM _alloc a WHERE a.target > 0 ORDER BY a.target DESC, a.domain_id LIMIT 1
      );
    END IF;
    v_remaining := v_remaining + 1;
  END LOOP;

  RETURN QUERY SELECT a.domain_id, a.target FROM _alloc a WHERE a.target > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_blueprint_domains(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.allocate_blueprint_domains(uuid, integer) TO authenticated, service_role;

-- ============================================================
-- Per-attempt question selection (server-authoritative)
-- ============================================================

CREATE OR REPLACE FUNCTION public.select_attempt_questions(
  _attempt_id uuid,
  _blueprint_id uuid,
  _total integer,
  _domain_filter uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  b public.exam_blueprints;
  a public.attempts;
  v_cutoff timestamptz;
  v_selected integer := 0;
  v_alloc jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  r record;
  v_taken integer;
BEGIN
  SELECT * INTO a FROM public.attempts WHERE id = _attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  SELECT * INTO b FROM public.exam_blueprints WHERE id = _blueprint_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Blueprint not found'; END IF;

  v_cutoff := now() - make_interval(days => b.repetition_cooldown_days);

  CREATE TEMP TABLE IF NOT EXISTS _picked (question_id uuid PRIMARY KEY, domain_id uuid)
    ON COMMIT DROP;
  DELETE FROM _picked;

  DROP TABLE IF EXISTS _pool;
  CREATE TEMP TABLE _pool ON COMMIT DROP AS
  SELECT
    q.id AS question_id,
    d.id AS domain_id,
    q.difficulty,
    q.points,
    q.scoring_method,
    q.is_pilot_eligible,
    COALESCE(qe.times_presented, 0) AS times_presented,
    qe.last_presented_at,
    COALESCE(qe.last_result, '') AS last_result
  FROM public.questions q
  LEFT JOIN public.topics t ON t.id = q.topic_id
  LEFT JOIN public.domains d ON d.id = t.domain_id
  LEFT JOIN public.question_exposure qe
    ON qe.question_id = q.id AND qe.user_id = a.user_id
  WHERE q.certification_id = b.certification_id
    AND q.is_active
    AND NOT q.is_archived
    AND q.governance_status = 'approved'
    AND q.question_type = ANY (b.allowed_question_types)
    AND EXISTS (SELECT 1 FROM public.question_options o WHERE o.question_id = q.id AND o.is_correct)
    AND (_domain_filter IS NULL OR d.id = _domain_filter)
    AND (
      b.mode <> 'revision'
      OR COALESCE(qe.last_result, '') IN ('incorrect', 'unanswered')
    );

  IF _domain_filter IS NULL THEN
    FOR r IN SELECT * FROM public.allocate_blueprint_domains(_blueprint_id, _total) LOOP
      INSERT INTO _picked (question_id, domain_id)
      SELECT p.question_id, p.domain_id
      FROM _pool p
      WHERE p.domain_id = r.domain_id
        AND p.question_id NOT IN (SELECT pk.question_id FROM _picked pk)
        AND (p.last_presented_at IS NULL OR p.last_presented_at < v_cutoff OR b.allow_repeats)
        AND (b.allow_repeats OR p.times_presented < b.max_repeat_count)
      ORDER BY (p.last_presented_at IS NULL) DESC, p.last_presented_at ASC, random()
      LIMIT r.target;
      GET DIAGNOSTICS v_taken = ROW_COUNT;

      -- Cooldown fallback: least recently presented eligible question wins.
      IF v_taken < r.target THEN
        INSERT INTO _picked (question_id, domain_id)
        SELECT p.question_id, p.domain_id
        FROM _pool p
        WHERE p.domain_id = r.domain_id
          AND p.question_id NOT IN (SELECT pk.question_id FROM _picked pk)
        ORDER BY p.times_presented ASC, p.last_presented_at ASC NULLS FIRST, p.question_id
        LIMIT (r.target - v_taken);

        v_warnings := v_warnings || jsonb_build_object(
          'domain_id', r.domain_id,
          'requested', r.target,
          'from_fresh_pool', v_taken,
          'reason', 'cooldown_relaxed_insufficient_pool'
        );
      END IF;

      v_alloc := v_alloc || jsonb_build_object(
        'domain_id', r.domain_id,
        'target', r.target,
        'selected', (SELECT COUNT(*) FROM _picked pk WHERE pk.domain_id = r.domain_id)
      );
    END LOOP;
  END IF;

  SELECT COUNT(*) INTO v_selected FROM _picked;
  IF v_selected < _total THEN
    INSERT INTO _picked (question_id, domain_id)
    SELECT p.question_id, p.domain_id
    FROM _pool p
    WHERE p.question_id NOT IN (SELECT pk.question_id FROM _picked pk)
    ORDER BY (p.last_presented_at IS NULL) DESC, p.times_presented ASC,
             p.last_presented_at ASC NULLS FIRST, random()
    LIMIT (_total - v_selected);
    SELECT COUNT(*) INTO v_selected FROM _picked;
    IF v_selected < _total THEN
      v_warnings := v_warnings || jsonb_build_object(
        'reason', 'insufficient_question_pool',
        'requested', _total,
        'selected', v_selected
      );
    END IF;
  END IF;

  INSERT INTO public.attempt_questions
    (attempt_id, question_id, position, option_order, is_pilot, points, scoring_method, domain_id)
  SELECT
    _attempt_id,
    s.question_id,
    s.pos,
    s.option_order,
    false,
    s.points,
    CASE WHEN b.allow_partial_credit THEN s.scoring_method ELSE 'all_or_nothing' END,
    s.domain_id
  FROM (
    SELECT
      pk.question_id,
      pk.domain_id,
      p.points,
      p.scoring_method,
      ROW_NUMBER() OVER (
        ORDER BY CASE WHEN b.randomize_questions THEN random() ELSE 0 END, pk.question_id
      )::int AS pos,
      COALESCE((
        SELECT array_agg(o.id ORDER BY
          CASE WHEN b.randomize_options THEN random() ELSE o.sort_order END)
        FROM public.question_options o WHERE o.question_id = pk.question_id
      ), '{}'::uuid[]) AS option_order
    FROM _picked pk
    JOIN _pool p ON p.question_id = pk.question_id
  ) s;

  IF b.pilot_question_count > 0 THEN
    UPDATE public.attempt_questions aq
    SET is_pilot = true
    WHERE aq.id IN (
      SELECT x.id FROM public.attempt_questions x
      JOIN public.questions q ON q.id = x.question_id
      WHERE x.attempt_id = _attempt_id AND q.is_pilot_eligible
      ORDER BY random()
      LIMIT b.pilot_question_count
    );
  END IF;

  INSERT INTO public.question_exposure AS qe
    (user_id, question_id, times_presented, first_presented_at, last_presented_at,
     last_attempt_id, attempt_ids)
  SELECT a.user_id, aq.question_id, 1, now(), now(), _attempt_id, ARRAY[_attempt_id]
  FROM public.attempt_questions aq
  WHERE aq.attempt_id = _attempt_id
  ON CONFLICT (user_id, question_id) DO UPDATE
  SET times_presented = qe.times_presented + 1,
      last_presented_at = now(),
      last_attempt_id = _attempt_id,
      attempt_ids = (qe.attempt_ids || _attempt_id),
      updated_at = now();

  RETURN jsonb_build_object(
    'blueprint_id', _blueprint_id,
    'blueprint_name', b.name,
    'mode', b.mode,
    'requested_total', _total,
    'selected_total', (SELECT COUNT(*) FROM public.attempt_questions WHERE attempt_id = _attempt_id),
    'pilot_count', (SELECT COUNT(*) FROM public.attempt_questions WHERE attempt_id = _attempt_id AND is_pilot),
    'domain_allocation', v_alloc,
    'warnings', v_warnings,
    'cooldown_days', b.repetition_cooldown_days,
    'scoring_model_version', b.scoring_model_version,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.select_attempt_questions(uuid, uuid, integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.select_attempt_questions(uuid, uuid, integer, uuid) TO service_role;

-- ============================================================
-- start_attempt: blueprint-aware, still server-authoritative
-- ============================================================

DROP FUNCTION IF EXISTS public.start_attempt(uuid, text);

CREATE OR REPLACE FUNCTION public.start_attempt(
  _exam_id uuid,
  _mode text,
  _question_count integer DEFAULT NULL,
  _domain_id uuid DEFAULT NULL
)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.start_attempt(uuid, text, integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.start_attempt(uuid, text, integer, uuid) TO authenticated, service_role;

-- ============================================================
-- Reads now follow the frozen set (legacy attempts fall back)
-- ============================================================

CREATE OR REPLACE FUNCTION public.attempt_item_set(_attempt_id uuid)
RETURNS TABLE(question_id uuid, sort_order integer, option_order uuid[], is_pilot boolean,
              points integer, scoring_method text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT aq.question_id, aq.position, aq.option_order, aq.is_pilot, aq.points, aq.scoring_method
  FROM public.attempt_questions aq
  WHERE aq.attempt_id = _attempt_id
  UNION ALL
  SELECT eq.question_id, eq.sort_order, '{}'::uuid[], false, q.points, q.scoring_method
  FROM public.attempts a
  JOIN public.exam_questions eq ON eq.exam_id = a.exam_id
  JOIN public.questions q ON q.id = eq.question_id
  WHERE a.id = _attempt_id
    AND NOT EXISTS (SELECT 1 FROM public.attempt_questions x WHERE x.attempt_id = _attempt_id)
$$;

REVOKE ALL ON FUNCTION public.attempt_item_set(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.attempt_item_set(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_attempt_questions(_attempt_id uuid)
RETURNS TABLE(question_id uuid, sort_order integer, stem text, scenario text,
              question_type text, points integer, options jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    q.id,
    items.sort_order,
    q.stem,
    q.scenario,
    q.question_type,
    items.points,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'content', o.content,
        'sort_order', COALESCE(array_position(items.option_order, o.id), o.sort_order)
      ) ORDER BY COALESCE(array_position(items.option_order, o.id), o.sort_order))
      FROM public.question_options o
      WHERE o.question_id = q.id
    ), '[]'::jsonb)
  FROM public.attempts a
  CROSS JOIN LATERAL public.attempt_item_set(a.id) AS items
  JOIN public.questions q ON q.id = items.question_id
  WHERE a.id = _attempt_id
    AND a.user_id = auth.uid()
  ORDER BY items.sort_order, q.created_at
$$;

CREATE OR REPLACE FUNCTION public.check_answer_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(current_setting('askmeexam.scoring', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.attempt_item_set(NEW.attempt_id) s
    WHERE s.question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'Question is not part of this exam';
  END IF;

  IF NEW.selected_option_ids IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM unnest(NEW.selected_option_ids) AS s(option_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.question_options o
         WHERE o.id = s.option_id AND o.question_id = NEW.question_id
       )
     ) THEN
    RAISE EXCEPTION 'Selected option does not belong to this question';
  END IF;

  NEW.is_correct := NULL;
  NEW.earned_points := NULL;
  NEW.answered_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Phase 2: versioned practice scoring
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_attempt(_attempt_id uuid)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.attempts;
  v_pass integer;
  v_limit integer;
  v_earned numeric(8,2) := 0;
  v_available numeric(8,2) := 0;
  v_scaled integer := 0;
  v_pct numeric(5,2) := 0;
  v_now timestamptz := now();
  v_elapsed integer;
  v_model text;
BEGIN
  SELECT * INTO a FROM public.attempts
  WHERE id = _attempt_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.status <> 'in_progress' THEN RETURN a; END IF;

  v_model := COALESCE(a.scoring_model_version, 'v1');

  SELECT COALESCE(b.passing_scaled_score, e.passing_score, 700), e.time_limit_minutes
  INTO v_pass, v_limit
  FROM public.exams e
  LEFT JOIN public.exam_blueprints b ON b.id = a.blueprint_id
  WHERE e.id = a.exam_id;
  v_pass := COALESCE(v_pass, 700);

  PERFORM set_config('askmeexam.scoring', 'on', true);

  -- Grade every stored answer against the server-held key.
  -- No answer ever loses points: partial credit floors at zero.
  UPDATE public.attempt_answers ans
  SET
    earned_points = g.earned,
    is_correct = (g.earned >= g.points AND g.points > 0)
  FROM (
    SELECT
      s.question_id,
      s.points,
      CASE
        WHEN key.correct_count = 0 THEN 0::numeric
        WHEN s.scoring_method = 'partial_credit' THEN
          ROUND(
            s.points * GREATEST(0, sel.hit_count - sel.miss_count)::numeric
              / key.correct_count::numeric,
            2
          )
        ELSE
          CASE WHEN sel.hit_count = key.correct_count AND sel.miss_count = 0
               THEN s.points::numeric ELSE 0::numeric END
      END AS earned
    FROM public.attempt_item_set(a.id) s
    JOIN public.attempt_answers aa
      ON aa.attempt_id = a.id AND aa.question_id = s.question_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS correct_count
      FROM public.question_options o
      WHERE o.question_id = s.question_id AND o.is_correct
    ) key
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE o.is_correct)::int AS hit_count,
        COUNT(*) FILTER (WHERE NOT o.is_correct)::int AS miss_count
      FROM unnest(COALESCE(aa.selected_option_ids, '{}'::uuid[])) AS sel_id
      JOIN public.question_options o ON o.id = sel_id
    ) sel
  ) g
  WHERE ans.attempt_id = a.id AND ans.question_id = g.question_id;

  SELECT
    COALESCE(SUM(s.points) FILTER (WHERE NOT s.is_pilot), 0),
    COALESCE(SUM(COALESCE(ans.earned_points, 0)) FILTER (WHERE NOT s.is_pilot), 0)
  INTO v_available, v_earned
  FROM public.attempt_item_set(a.id) s
  LEFT JOIN public.attempt_answers ans
    ON ans.attempt_id = a.id AND ans.question_id = s.question_id;

  IF v_available > 0 THEN
    v_pct := ROUND((v_earned / v_available) * 100, 2);
    -- Scoring model v1: 1 + ratio * 999, clamped to the 1-1000 display band.
    v_scaled := LEAST(1000, GREATEST(1, ROUND(1 + (v_earned / v_available) * 999)::int));
  END IF;

  v_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (v_now - a.started_at))::integer);
  IF a.expires_at IS NOT NULL THEN
    v_elapsed := LEAST(v_elapsed, GREATEST(0, EXTRACT(EPOCH FROM (a.expires_at - a.started_at))::integer));
  ELSIF a.mode = 'timed' AND v_limit IS NOT NULL THEN
    v_elapsed := LEAST(v_elapsed, v_limit * 60);
  END IF;

  UPDATE public.attempts SET
    status = 'submitted',
    submitted_at = v_now,
    duration_seconds = v_elapsed,
    earned_points = v_earned,
    available_points = v_available,
    raw_score = ROUND(v_earned)::int,
    max_score = ROUND(v_available)::int,
    percentage = v_pct,
    scaled_score = v_scaled,
    scoring_model_version = v_model,
    scored_count = (SELECT COUNT(*)::int FROM public.attempt_item_set(a.id) s WHERE NOT s.is_pilot),
    pilot_count = (SELECT COUNT(*)::int FROM public.attempt_item_set(a.id) s WHERE s.is_pilot),
    passed = (v_scaled >= v_pass),
    score = v_scaled
  WHERE id = a.id
  RETURNING * INTO a;

  UPDATE public.question_exposure qe
  SET last_result = CASE
        WHEN COALESCE(cardinality(ans.selected_option_ids), 0) = 0 THEN 'unanswered'
        WHEN ans.is_correct THEN 'correct'
        ELSE 'incorrect'
      END,
      last_marked_for_review = COALESCE(ans.marked_for_review, false),
      updated_at = now()
  FROM public.attempt_questions aq
  LEFT JOIN public.attempt_answers ans
    ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
  WHERE aq.attempt_id = a.id
    AND qe.user_id = a.user_id
    AND qe.question_id = aq.question_id;

  PERFORM set_config('askmeexam.scoring', 'off', true);

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (a.user_id, 'attempt.submitted', 'attempt', a.id, jsonb_build_object(
    'scoring_model_version', v_model,
    'earned_points', v_earned,
    'available_points', v_available,
    'scaled_score', v_scaled,
    'passed', a.passed,
    'pilot_count', a.pilot_count
  ));

  RETURN a;
END;
$$;

-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_attempt_result(uuid);

CREATE OR REPLACE FUNCTION public.get_attempt_result(_attempt_id uuid)
RETURNS TABLE(attempt_id uuid, exam_title text, mode text, submitted_at timestamptz,
              duration_seconds integer, raw_score integer, max_score integer, percentage numeric,
              scaled_score integer, passing_score integer, passed boolean, total_questions integer,
              correct_count integer, incorrect_count integer, unanswered_count integer,
              domains jsonb, scoring_model_version text, pilot_count integer,
              scored_count integer, earned_points numeric, available_points numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH a AS (
    SELECT * FROM public.attempts
    WHERE id = _attempt_id
      AND status = 'submitted'
      AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ),
  rows AS (
    SELECT
      q.id AS question_id,
      s.is_pilot,
      COALESCE(d.name, 'Unassigned') AS domain_name,
      COALESCE(d.sort_order, 9999) AS domain_sort,
      COALESCE(ans.is_correct, false) AS is_correct,
      COALESCE(cardinality(ans.selected_option_ids), 0) = 0 AS unanswered
    FROM a
    CROSS JOIN LATERAL public.attempt_item_set(a.id) s
    JOIN public.questions q ON q.id = s.question_id
    LEFT JOIN public.topics t ON t.id = q.topic_id
    LEFT JOIN public.domains d ON d.id = t.domain_id
    LEFT JOIN public.attempt_answers ans
      ON ans.attempt_id = a.id AND ans.question_id = q.id
  ),
  per_domain AS (
    SELECT domain_name, domain_sort,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_correct)::int AS correct
    FROM rows WHERE NOT is_pilot GROUP BY domain_name, domain_sort
  )
  SELECT
    a.id,
    e.title,
    a.mode,
    a.submitted_at,
    a.duration_seconds,
    a.raw_score,
    a.max_score,
    a.percentage,
    a.scaled_score,
    COALESCE(b.passing_scaled_score, e.passing_score),
    a.passed,
    (SELECT COUNT(*)::int FROM rows),
    (SELECT COUNT(*) FILTER (WHERE r.is_correct)::int FROM rows r WHERE NOT r.is_pilot),
    (SELECT COUNT(*) FILTER (WHERE NOT r.is_correct AND NOT r.unanswered)::int FROM rows r WHERE NOT r.is_pilot),
    (SELECT COUNT(*) FILTER (WHERE r.unanswered)::int FROM rows r WHERE NOT r.is_pilot),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', pd.domain_name,
        'total', pd.total,
        'correct', pd.correct,
        'percentage', CASE WHEN pd.total > 0
          THEN ROUND((pd.correct::numeric / pd.total::numeric) * 100, 1) ELSE 0 END
      ) ORDER BY pd.domain_sort, pd.domain_name)
      FROM per_domain pd
    ), '[]'::jsonb),
    COALESCE(a.scoring_model_version, 'v1'),
    a.pilot_count,
    a.scored_count,
    a.earned_points,
    a.available_points
  FROM a
  JOIN public.exams e ON e.id = a.exam_id
  LEFT JOIN public.exam_blueprints b ON b.id = a.blueprint_id
$$;

DROP FUNCTION IF EXISTS public.get_attempt_review(uuid);

CREATE OR REPLACE FUNCTION public.get_attempt_review(_attempt_id uuid)
RETURNS TABLE(question_id uuid, sort_order integer, stem text, scenario text, question_type text,
              points integer, difficulty text, domain_name text, topic_name text, explanation text,
              marked_for_review boolean, selected_option_ids uuid[], status text, options jsonb,
              is_pilot boolean, earned_points numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    q.id,
    s.sort_order,
    q.stem,
    q.scenario,
    q.question_type,
    s.points,
    q.difficulty,
    d.name,
    t.name,
    q.explanation,
    COALESCE(aa.marked_for_review, false),
    COALESCE(aa.selected_option_ids, ARRAY[]::uuid[]),
    CASE
      WHEN aa.id IS NULL OR COALESCE(array_length(aa.selected_option_ids, 1), 0) = 0 THEN 'unanswered'
      WHEN COALESCE(aa.is_correct, false) THEN 'correct'
      WHEN COALESCE(aa.earned_points, 0) > 0 THEN 'partial'
      ELSE 'incorrect'
    END,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'content', o.content,
        'sort_order', COALESCE(array_position(s.option_order, o.id), o.sort_order),
        'is_correct', o.is_correct
      ) ORDER BY COALESCE(array_position(s.option_order, o.id), o.sort_order))
      FROM public.question_options o
      WHERE o.question_id = q.id
    ), '[]'::jsonb),
    s.is_pilot,
    aa.earned_points
  FROM public.attempts a
  CROSS JOIN LATERAL public.attempt_item_set(a.id) s
  JOIN public.questions q ON q.id = s.question_id
  LEFT JOIN public.topics t ON t.id = q.topic_id
  LEFT JOIN public.domains d ON d.id = t.domain_id
  LEFT JOIN public.attempt_answers aa
    ON aa.attempt_id = a.id AND aa.question_id = q.id
  WHERE a.id = _attempt_id
    AND a.status = 'submitted'
    AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ORDER BY s.sort_order, q.created_at
$$;

CREATE OR REPLACE FUNCTION public.exam_is_available(_exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = _exam_id
      AND e.is_active
      AND e.is_published
      AND (e.allow_timed OR e.allow_practice)
      AND (NOT e.allow_timed OR e.time_limit_minutes IS NOT NULL OR e.blueprint_id IS NOT NULL)
      AND (
        (e.blueprint_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.questions q
          WHERE q.certification_id = e.certification_id
            AND q.is_active AND NOT q.is_archived
            AND q.governance_status = 'approved'
        ))
        OR (e.question_count > 0 AND EXISTS (
          SELECT 1
          FROM public.exam_questions eq
          JOIN public.questions q ON q.id = eq.question_id
          WHERE eq.exam_id = e.id AND q.is_active AND NOT q.is_archived
        ))
      )
  );
$$;

-- ============================================================
-- Seed the default Realistic SC-300 Mock Exam blueprint
-- ============================================================

DO $$
DECLARE
  cert public.certifications;
  bp_id uuid;
  dom record;
  i integer := 0;
BEGIN
  FOR cert IN
    SELECT * FROM public.certifications
    WHERE upper(COALESCE(exam_code, code)) LIKE 'SC-300%'
  LOOP
    IF EXISTS (SELECT 1 FROM public.exam_blueprints WHERE certification_id = cert.id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.exam_blueprints (
      certification_id, name, description, mode, duration_minutes,
      default_question_count, min_question_count, max_question_count,
      passing_scaled_score, scoring_model_version, case_study_count
    ) VALUES (
      cert.id,
      'Realistic SC-300 Mock Exam',
      'AskMeExam practice mock modelled on the published SC-300 skills outline. 50 scored questions is an AskMeExam practice default, not a guarantee that every real sitting contains 50 questions.',
      'realistic_mock', 100, 50, 35, 60, 700, 'v1', 0
    ) RETURNING id INTO bp_id;

    i := 0;
    FOR dom IN
      SELECT d.id, d.name FROM public.domains d
      WHERE d.certification_id = cert.id AND d.is_active
      ORDER BY d.sort_order, d.name
    LOOP
      INSERT INTO public.exam_blueprint_domains (blueprint_id, domain_id, min_percent, max_percent, sort_order)
      VALUES (
        bp_id, dom.id,
        CASE WHEN i = 1 THEN 25 ELSE 20 END,
        CASE WHEN i = 1 THEN 30 ELSE 25 END,
        i
      );
      i := i + 1;
    END LOOP;
  END LOOP;
END;
$$;