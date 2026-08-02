ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS committed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS committed_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commit_report jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.import_staged_rows
  ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committed_at timestamptz;

CREATE OR REPLACE FUNCTION public.commit_import_batch(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b public.import_batches;
  r record;
  n jsonb;
  v_cert uuid;
  v_domain uuid;
  v_topic uuid;
  v_question uuid;
  v_opt jsonb;
  v_sort integer;
  v_imported integer := 0;
  v_skipped integer := 0;
  v_unresolved integer := 0;
  v_report jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  -- Row lock makes a concurrent second commit wait, then fail the status check.
  SELECT * INTO b FROM public.import_batches WHERE id = _batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import batch not found'; END IF;
  IF b.status = 'committed' THEN RAISE EXCEPTION 'This import has already been committed'; END IF;
  IF b.status <> 'staged' THEN RAISE EXCEPTION 'Only staged imports can be committed'; END IF;
  IF b.expires_at <= now() THEN RAISE EXCEPTION 'This staged import has expired; upload the file again'; END IF;
  IF b.attested_at IS NULL OR coalesce(btrim(b.attestation_statement), '') = '' THEN
    RAISE EXCEPTION 'The originality attestation must be recorded before committing';
  END IF;

  SELECT count(*) INTO v_unresolved
  FROM public.import_staged_rows
  WHERE batch_id = b.id
    AND is_valid
    AND duplicate_status NOT IN ('unchecked', 'none')
    AND review_status <> 'cleared';
  IF v_unresolved > 0 THEN
    RAISE EXCEPTION 'Resolve the % flagged duplicate row(s) before committing', v_unresolved;
  END IF;

  SELECT count(*) INTO v_skipped
  FROM public.import_staged_rows WHERE batch_id = b.id AND NOT is_valid;

  FOR r IN
    SELECT * FROM public.import_staged_rows
    WHERE batch_id = b.id AND is_valid
    ORDER BY row_number
  LOOP
    n := r.normalized;

    SELECT c.id INTO v_cert
    FROM public.certifications c
    WHERE c.is_active
      AND (lower(c.code) = lower(n->>'certification') OR lower(c.name) = lower(n->>'certification'))
    ORDER BY c.created_at
    LIMIT 1;
    IF v_cert IS NULL THEN
      RAISE EXCEPTION 'Row %: certification "%" was not found or is inactive', r.row_number, n->>'certification';
    END IF;

    SELECT d.id INTO v_domain
    FROM public.domains d
    WHERE d.certification_id = v_cert AND lower(d.name) = lower(n->>'domain')
    LIMIT 1;
    IF v_domain IS NULL THEN
      RAISE EXCEPTION 'Row %: domain "%" was not found under certification "%"', r.row_number, n->>'domain', n->>'certification';
    END IF;

    SELECT t.id INTO v_topic
    FROM public.topics t
    WHERE t.domain_id = v_domain AND lower(t.name) = lower(n->>'topic')
    LIMIT 1;
    IF v_topic IS NULL THEN
      RAISE EXCEPTION 'Row %: topic "%" was not found under domain "%"', r.row_number, n->>'topic', n->>'domain';
    END IF;

    INSERT INTO public.questions
      (certification_id, topic_id, stem, scenario, explanation, question_type,
       difficulty, points, tags, is_active, is_archived, governance_status, import_batch_id)
    VALUES (
      v_cert, v_topic, n->>'question_text', NULLIF(n->>'scenario_text', ''),
      NULLIF(n->>'explanation', ''), n->>'question_type',
      coalesce(n->>'difficulty', 'medium'),
      coalesce((n->>'point_value')::int, 1),
      coalesce((SELECT array_agg(value::text) FROM jsonb_array_elements_text(coalesce(n->'tags', '[]'::jsonb)) AS value), '{}'::text[]),
      coalesce(n->>'status', 'active') = 'active',
      coalesce(n->>'status', 'active') = 'inactive',
      'draft', b.id)
    RETURNING id INTO v_question;

    v_sort := 0;
    FOR v_opt IN SELECT * FROM jsonb_array_elements(coalesce(n->'options', '[]'::jsonb))
    LOOP
      INSERT INTO public.question_options (question_id, label, content, is_correct, sort_order)
      VALUES (v_question, upper(v_opt->>'letter'), v_opt->>'content',
              coalesce((v_opt->>'is_correct')::boolean, false), v_sort);
      v_sort := v_sort + 1;
    END LOOP;

    IF v_sort < 2 THEN
      RAISE EXCEPTION 'Row %: at least two answer options are required', r.row_number;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.question_options o WHERE o.question_id = v_question AND o.is_correct) THEN
      RAISE EXCEPTION 'Row %: no correct answer option was recorded', r.row_number;
    END IF;

    UPDATE public.import_staged_rows
    SET question_id = v_question, committed_at = now()
    WHERE id = r.id;

    v_imported := v_imported + 1;
  END LOOP;

  IF v_imported = 0 THEN
    RAISE EXCEPTION 'This import has no valid rows to commit';
  END IF;

  v_report := jsonb_build_object(
    'imported', v_imported,
    'skipped_invalid', v_skipped,
    'total_rows', b.total_rows,
    'committed_at', now());

  UPDATE public.import_batches
  SET status = 'committed', committed_by = auth.uid(), committed_at = now(),
      imported_rows = v_imported, failed_rows = v_skipped,
      commit_report = v_report, updated_at = now()
  WHERE id = b.id;

  -- Keep derived exam statistics consistent with the question bank.
  UPDATE public.exams e
  SET question_count = sub.c
  FROM (
    SELECT eq.exam_id, count(*)::int AS c
    FROM public.exam_questions eq
    JOIN public.questions q ON q.id = eq.question_id
    WHERE q.is_active AND NOT q.is_archived
    GROUP BY eq.exam_id
  ) sub
  WHERE e.id = sub.exam_id AND e.question_count IS DISTINCT FROM sub.c;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), 'import.committed', 'import_batch', b.id, b.filename, v_report);

  RETURN v_report;
END;
$function$;

REVOKE ALL ON FUNCTION public.commit_import_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_import_batch(uuid) TO authenticated;