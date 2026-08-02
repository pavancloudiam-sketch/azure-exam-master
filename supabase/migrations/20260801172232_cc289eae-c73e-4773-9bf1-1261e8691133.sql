CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.import_staged_rows
  ADD COLUMN duplicate_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN duplicate_score numeric(4,3),
  ADD COLUMN duplicate_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_note text,
  ADD CONSTRAINT import_staged_rows_dup_chk
    CHECK (duplicate_status IN ('unchecked','none','exact','normalized','near','similar_options')),
  ADD CONSTRAINT import_staged_rows_review_chk
    CHECK (review_status IN ('pending','flagged','cleared'));

ALTER TABLE public.import_batches
  ADD COLUMN duplicate_scanned_at timestamptz,
  ADD COLUMN flagged_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN attested_by uuid REFERENCES auth.users(id),
  ADD COLUMN attested_at timestamptz,
  ADD COLUMN attestation_statement text;

-- Lowercased, punctuation-stripped, whitespace-collapsed comparison form.
CREATE OR REPLACE FUNCTION public.normalize_content(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(_text, '')), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Order-independent fingerprint of a question's answer options.
CREATE OR REPLACE FUNCTION public.options_fingerprint(_question_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT string_agg(public.normalize_content(o.content), ' | ' ORDER BY public.normalize_content(o.content))
  FROM public.question_options o
  WHERE o.question_id = _question_id
$$;

CREATE INDEX IF NOT EXISTS questions_stem_trgm_idx
  ON public.questions USING gin (public.normalize_content(stem) extensions.gin_trgm_ops);

/**
 * Compares every valid staged row in a batch against the internal AskMeExam
 * question bank only. There is no external plagiarism service wired in.
 * Purely advisory: rows are flagged for an administrator, never rejected.
 */
CREATE OR REPLACE FUNCTION public.scan_import_duplicates(_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  m record;
  v_matches jsonb;
  v_status text;
  v_score numeric(4,3);
  v_flagged integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.import_batches b
    WHERE b.id = _batch_id AND b.created_by = auth.uid() AND b.status = 'staged'
  ) THEN
    RAISE EXCEPTION 'Staged batch not found';
  END IF;

  FOR r IN
    SELECT id,
           normalized ->> 'question_text' AS q_text,
           coalesce(normalized ->> 'scenario_text', '') AS s_text,
           coalesce((
             SELECT string_agg(public.normalize_content(o ->> 'content'), ' | '
                    ORDER BY public.normalize_content(o ->> 'content'))
             FROM jsonb_array_elements(coalesce(normalized -> 'options', '[]'::jsonb)) AS o
           ), '') AS opt_fp
    FROM public.import_staged_rows
    WHERE batch_id = _batch_id AND is_valid
  LOOP
    v_matches := '[]'::jsonb;
    v_status := 'none';
    v_score := NULL;

    FOR m IN
      SELECT q.id,
             q.stem,
             CASE
               WHEN q.stem = r.q_text THEN 'exact'
               WHEN public.normalize_content(q.stem) = public.normalize_content(r.q_text) THEN 'normalized'
               WHEN extensions.similarity(public.normalize_content(q.stem), public.normalize_content(r.q_text)) >= 0.80 THEN 'near'
               ELSE 'similar_options'
             END AS match_type,
             GREATEST(
               extensions.similarity(public.normalize_content(q.stem), public.normalize_content(r.q_text)),
               CASE WHEN r.opt_fp = '' THEN 0
                    ELSE extensions.similarity(coalesce(public.options_fingerprint(q.id), ''), r.opt_fp) END,
               CASE WHEN r.s_text = '' OR coalesce(q.scenario, '') = '' THEN 0
                    ELSE extensions.similarity(public.normalize_content(q.scenario), public.normalize_content(r.s_text)) END
             )::numeric(4,3) AS score
      FROM public.questions q
      WHERE
        q.stem = r.q_text
        OR public.normalize_content(q.stem) = public.normalize_content(r.q_text)
        OR extensions.similarity(public.normalize_content(q.stem), public.normalize_content(r.q_text)) >= 0.80
        OR (r.opt_fp <> '' AND extensions.similarity(coalesce(public.options_fingerprint(q.id), ''), r.opt_fp) >= 0.85)
        OR (
          r.s_text <> '' AND coalesce(q.scenario, '') <> ''
          AND extensions.similarity(public.normalize_content(q.scenario), public.normalize_content(r.s_text)) >= 0.85
        )
      ORDER BY score DESC
      LIMIT 5
    LOOP
      v_matches := v_matches || jsonb_build_object(
        'question_id', m.id,
        'stem', left(m.stem, 240),
        'match_type', m.match_type,
        'score', m.score
      );
      v_score := GREATEST(coalesce(v_score, 0), m.score);
      v_status := CASE
        WHEN v_status = 'exact' OR m.match_type = 'exact' THEN 'exact'
        WHEN v_status = 'normalized' OR m.match_type = 'normalized' THEN 'normalized'
        WHEN v_status = 'near' OR m.match_type = 'near' THEN 'near'
        ELSE 'similar_options'
      END;
    END LOOP;

    UPDATE public.import_staged_rows
    SET duplicate_status = v_status,
        duplicate_score = v_score,
        duplicate_matches = v_matches,
        review_status = CASE WHEN v_status = 'none' THEN 'cleared' ELSE 'pending' END,
        reviewed_by = NULL,
        reviewed_at = NULL,
        review_note = NULL
    WHERE id = r.id;

    IF v_status <> 'none' THEN
      v_flagged := v_flagged + 1;
    END IF;
  END LOOP;

  UPDATE public.import_batches
  SET duplicate_scanned_at = now(), flagged_rows = v_flagged
  WHERE id = _batch_id;

  RETURN v_flagged;
END;
$$;

/** Records the manual originality attestation for a staged batch. */
CREATE OR REPLACE FUNCTION public.attest_import_batch(_batch_id uuid, _statement text)
RETURNS public.import_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b public.import_batches;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF coalesce(btrim(_statement), '') = '' THEN
    RAISE EXCEPTION 'An attestation statement is required';
  END IF;

  UPDATE public.import_batches
  SET attested_by = auth.uid(), attested_at = now(), attestation_statement = _statement
  WHERE id = _batch_id AND created_by = auth.uid() AND status = 'staged'
  RETURNING * INTO b;

  IF NOT FOUND THEN RAISE EXCEPTION 'Staged batch not found'; END IF;
  RETURN b;
END;
$$;