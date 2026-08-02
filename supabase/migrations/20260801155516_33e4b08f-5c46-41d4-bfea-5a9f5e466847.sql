-- 1. is_active + updated_at on domains and topics
ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_domains_updated_at ON public.domains;
CREATE TRIGGER set_domains_updated_at BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_topics_updated_at ON public.topics;
CREATE TRIGGER set_topics_updated_at BEFORE UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_certifications_updated_at ON public.certifications;
CREATE TRIGGER set_certifications_updated_at BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. No hard deletes on taxonomy tables: replace ALL policies with select/insert/update only
DROP POLICY IF EXISTS certifications_admin_write ON public.certifications;
DROP POLICY IF EXISTS domains_admin_write ON public.domains;
DROP POLICY IF EXISTS topics_admin_write ON public.topics;

CREATE POLICY certifications_admin_insert ON public.certifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY certifications_admin_update ON public.certifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY domains_admin_insert ON public.domains FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY domains_admin_update ON public.domains FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY topics_admin_insert ON public.topics FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY topics_admin_update ON public.topics FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE DELETE ON public.certifications, public.domains, public.topics FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.certifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.domains TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.topics TO authenticated;

-- 3. Read policies honour is_active (admins see everything)
DROP POLICY IF EXISTS domains_read ON public.domains;
CREATE POLICY domains_read ON public.domains FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (is_active AND EXISTS (
      SELECT 1 FROM public.certifications c
      WHERE c.id = domains.certification_id AND c.is_active
    ))
  );

DROP POLICY IF EXISTS topics_read ON public.topics;
CREATE POLICY topics_read ON public.topics FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (is_active AND EXISTS (
      SELECT 1 FROM public.domains d
      JOIN public.certifications c ON c.id = d.certification_id
      WHERE d.id = topics.domain_id AND d.is_active AND c.is_active
    ))
  );

-- 4. Admin audit log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY audit_logs_insert_admin ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- 5. Phase 1: exactly one active certification
INSERT INTO public.certifications (code, name, description, is_active)
SELECT 'ENTRA-ID', 'Microsoft Entra ID certification practice',
       'Practice content for Microsoft Entra ID identity and access administration. Related exam metadata: SC-300.',
       true
WHERE NOT EXISTS (SELECT 1 FROM public.certifications);

UPDATE public.certifications SET is_active = false
WHERE is_active = true
  AND id <> (SELECT id FROM public.certifications ORDER BY created_at LIMIT 1);