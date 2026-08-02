CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_id uuid REFERENCES public.certifications(id),
  filename text NOT NULL,
  file_type text NOT NULL DEFAULT 'csv',
  status text NOT NULL DEFAULT 'staged',
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  notes text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_batches_file_type_chk CHECK (file_type IN ('csv', 'xlsx')),
  CONSTRAINT import_batches_status_chk CHECK (status IN ('staged', 'discarded', 'committed', 'expired'))
);

CREATE TABLE public.import_staged_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  external_id text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_valid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);

CREATE INDEX import_staged_rows_batch_idx ON public.import_staged_rows (batch_id, row_number);
CREATE INDEX import_batches_creator_idx ON public.import_batches (created_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_staged_rows TO authenticated;
GRANT ALL ON public.import_staged_rows TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_staged_rows ENABLE ROW LEVEL SECURITY;

-- Admin-only, and scoped to the admin who uploaded the file.
CREATE POLICY import_batches_own_admin ON public.import_batches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY import_staged_rows_own_admin ON public.import_staged_rows
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.import_batches b
      WHERE b.id = import_staged_rows.batch_id AND b.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.import_batches b
      WHERE b.id = import_staged_rows.batch_id AND b.created_by = auth.uid()
        AND b.status = 'staged'
    )
  );

CREATE TRIGGER import_batches_set_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();