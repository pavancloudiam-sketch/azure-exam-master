CREATE TABLE public.organization_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_name text NOT NULL DEFAULT '',
  tagline text NOT NULL DEFAULT '',
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#1e3a5f',
  accent_color text NOT NULL DEFAULT '#2f7fd1',
  background_color text NOT NULL DEFAULT '#ffffff',
  surface_color text NOT NULL DEFAULT '#f4f6f9',
  foreground_color text NOT NULL DEFAULT '#111a2b',
  theme_mode text NOT NULL DEFAULT 'light',
  email_from_name text NOT NULL DEFAULT '',
  email_reply_to text,
  email_header_color text NOT NULL DEFAULT '#1e3a5f',
  email_footer_text text NOT NULL DEFAULT '',
  support_email text,
  custom_domain text UNIQUE,
  custom_domain_verified boolean NOT NULL DEFAULT false,
  custom_domain_verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_branding_theme_mode_check CHECK (theme_mode IN ('light','dark')),
  CONSTRAINT organization_branding_primary_color_check CHECK (primary_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT organization_branding_accent_color_check CHECK (accent_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT organization_branding_background_color_check CHECK (background_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT organization_branding_surface_color_check CHECK (surface_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT organization_branding_foreground_color_check CHECK (foreground_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT organization_branding_email_header_color_check CHECK (email_header_color ~* '^#[0-9a-f]{6}$'),
  CONSTRAINT organization_branding_custom_domain_check CHECK (
    custom_domain IS NULL OR custom_domain ~* '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_branding TO authenticated;
GRANT ALL ON public.organization_branding TO service_role;

ALTER TABLE public.organization_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own org branding"
ON public.organization_branding FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins insert own org branding"
ON public.organization_branding FOR INSERT TO authenticated
WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins update own org branding"
ON public.organization_branding FOR UPDATE TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins delete own org branding"
ON public.organization_branding FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_organization_branding_updated_at
BEFORE UPDATE ON public.organization_branding
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Normalise the custom domain and reset verification whenever it changes.
CREATE OR REPLACE FUNCTION public.organization_branding_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.custom_domain := nullif(lower(trim(NEW.custom_domain)), '');
  IF TG_OP = 'UPDATE' AND NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
    NEW.custom_domain_verified := false;
    NEW.custom_domain_verification_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organization_branding_normalize_trg
BEFORE INSERT OR UPDATE ON public.organization_branding
FOR EACH ROW EXECUTE FUNCTION public.organization_branding_normalize();

-- Public, unauthenticated lookup used to theme a verified custom domain before
-- sign-in. Exposes only presentation fields, never tenant data.
CREATE OR REPLACE FUNCTION public.get_branding_for_domain(_host text)
RETURNS TABLE (
  app_name text,
  tagline text,
  logo_url text,
  favicon_url text,
  primary_color text,
  accent_color text,
  background_color text,
  surface_color text,
  foreground_color text,
  theme_mode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.app_name, b.tagline, b.logo_url, b.favicon_url, b.primary_color,
         b.accent_color, b.background_color, b.surface_color, b.foreground_color,
         b.theme_mode
  FROM public.organization_branding b
  JOIN public.organizations o ON o.id = b.organization_id
  WHERE b.custom_domain = lower(trim(_host))
    AND b.custom_domain_verified
    AND b.is_published
    AND o.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_branding_for_domain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_branding_for_domain(text) TO anon, authenticated, service_role;