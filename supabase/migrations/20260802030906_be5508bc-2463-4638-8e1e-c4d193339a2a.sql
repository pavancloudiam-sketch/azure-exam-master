-- ============ ENUMS ============
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'manager', 'member');
CREATE TYPE public.org_member_status AS ENUM ('invited', 'active', 'removed');

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  contact_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============ MEMBERS ============
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.org_member_status NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_members_user ON public.organization_members(user_id, status);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id, status);

-- ============ ROLES (separate table: no self-promotion) ============
CREATE TABLE public.organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.organization_roles TO authenticated;
GRANT ALL ON public.organization_roles TO service_role;
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_roles_lookup ON public.organization_roles(user_id, organization_id, role);

-- ============ HELPER FUNCTIONS (security definer, no recursion) ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org_id AND m.user_id = _user_id AND m.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _role public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_roles r
    JOIN public.organization_members m
      ON m.organization_id = r.organization_id AND m.user_id = r.user_id AND m.status = 'active'
    WHERE r.organization_id = _org_id AND r.user_id = _user_id AND r.role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org_id, _user_id, 'owner')
      OR public.has_org_role(_org_id, _user_id, 'admin')
$$;

-- ============ SETTINGS ============
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  default_certification_id uuid REFERENCES public.certifications(id),
  allow_domain_join boolean NOT NULL DEFAULT false,
  allowed_email_domains text[] NOT NULL DEFAULT '{}',
  seat_limit integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- ============ ORG ENTITLEMENTS ============
CREATE TABLE public.organization_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_scope text NOT NULL CHECK (access_scope IN ('all', 'certification', 'exam')),
  certification_id uuid REFERENCES public.certifications(id),
  exam_id uuid REFERENCES public.exams(id),
  seats integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_entitlements TO authenticated;
GRANT ALL ON public.organization_entitlements TO service_role;
ALTER TABLE public.organization_entitlements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_entitlements_org ON public.organization_entitlements(organization_id, status);

-- ============ POLICIES: organizations ============
CREATE POLICY "Members read own organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins create organizations" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins update own organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_admin(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ POLICIES: organization_members ============
CREATE POLICY "Read own membership or same-org members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Org admins invite members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Org admins manage members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- invited users may accept their own invitation (status invited -> active only)
CREATE POLICY "Invited user accepts own invitation" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'invited')
  WITH CHECK (user_id = auth.uid() AND status = 'active');

-- ============ POLICIES: organization_roles ============
CREATE POLICY "Read roles in own organization" ON public.organization_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Org admins grant roles" ON public.organization_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id <> auth.uid()
    AND (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Org admins revoke roles" ON public.organization_roles
  FOR DELETE TO authenticated
  USING (
    user_id <> auth.uid()
    AND (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );

-- ============ POLICIES: organization_settings ============
CREATE POLICY "Members read own org settings" ON public.organization_settings
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins insert own org settings" ON public.organization_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins update own org settings" ON public.organization_settings
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ POLICIES: organization_entitlements ============
CREATE POLICY "Members read own org entitlements" ON public.organization_entitlements
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ TENANT-AWARE AUDIT LOGS ============
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id, created_at DESC);

CREATE POLICY "Org admins read own org audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_admin(organization_id, auth.uid()));

-- ============ TRIGGERS ============
CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_org_members_updated_at BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_org_settings_updated_at BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_org_entitlements_updated_at BEFORE UPDATE ON public.organization_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SERVER-SIDE MANAGEMENT RPCS ============
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text, _contact_email text DEFAULT NULL, _owner_id uuid DEFAULT NULL)
RETURNS public.organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.organizations; v_owner uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Platform admin role required'; END IF;
  IF coalesce(btrim(_name), '') = '' THEN RAISE EXCEPTION 'An organisation name is required'; END IF;
  IF coalesce(btrim(_slug), '') = '' THEN RAISE EXCEPTION 'A slug is required'; END IF;

  INSERT INTO public.organizations (name, slug, contact_email, created_by)
  VALUES (btrim(_name), lower(btrim(_slug)), NULLIF(btrim(coalesce(_contact_email, '')), ''), auth.uid())
  RETURNING * INTO o;

  INSERT INTO public.organization_settings (organization_id) VALUES (o.id);

  v_owner := coalesce(_owner_id, auth.uid());
  INSERT INTO public.organization_members (organization_id, user_id, status, invited_by, joined_at)
  VALUES (o.id, v_owner, 'active', auth.uid(), now());
  INSERT INTO public.organization_roles (organization_id, user_id, role, granted_by)
  VALUES (o.id, v_owner, 'owner', auth.uid());

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'organization.created', 'organization', o.id, o.name,
          jsonb_build_object('slug', o.slug, 'owner_id', v_owner), o.id);
  RETURN o;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_organization_member(_org_id uuid, _email text, _role public.org_role DEFAULT 'member')
RETURNS public.organization_members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.organization_members; v_user uuid;
BEGIN
  IF NOT (public.is_org_admin(_org_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;
  IF _role = 'owner' AND NOT (public.has_org_role(_org_id, auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only an owner can grant owner access';
  END IF;

  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(btrim(_email));
  IF v_user IS NULL THEN RAISE EXCEPTION 'No AskMeExam account found for that email'; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, status, invited_by)
  VALUES (_org_id, v_user, 'invited', auth.uid())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = CASE WHEN public.organization_members.status = 'removed' THEN 'invited'::public.org_member_status
                      ELSE public.organization_members.status END,
        removed_at = NULL, invited_by = auth.uid()
  RETURNING * INTO m;

  INSERT INTO public.organization_roles (organization_id, user_id, role, granted_by)
  VALUES (_org_id, v_user, _role, auth.uid())
  ON CONFLICT (organization_id, user_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'organization.member_invited', 'organization_member', m.id, NULL,
          jsonb_build_object('role', _role), _org_id);
  RETURN m;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_organization_member(_org_id uuid, _user_id uuid)
RETURNS public.organization_members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.organization_members;
BEGIN
  IF NOT (public.is_org_admin(_org_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself'; END IF;
  IF public.has_org_role(_org_id, _user_id, 'owner') AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Owners can only be removed by a platform administrator';
  END IF;

  UPDATE public.organization_members
  SET status = 'removed', removed_at = now()
  WHERE organization_id = _org_id AND user_id = _user_id
  RETURNING * INTO m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  DELETE FROM public.organization_roles WHERE organization_id = _org_id AND user_id = _user_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'organization.member_removed', 'organization_member', m.id, NULL, '{}'::jsonb, _org_id);
  RETURN m;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(_org_id uuid)
RETURNS public.organization_members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.organization_members;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.organization_members
  SET status = 'active', joined_at = now()
  WHERE organization_id = _org_id AND user_id = auth.uid() AND status = 'invited'
  RETURNING * INTO m;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending invitation found'; END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'organization.invitation_accepted', 'organization_member', m.id, NULL, '{}'::jsonb, _org_id);
  RETURN m;
END;
$$;

-- Organisation-granted exam access, additive to individual entitlements
CREATE OR REPLACE FUNCTION public.has_org_exam_access(_user_id uuid, _exam_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_entitlements oe
    JOIN public.organization_members m
      ON m.organization_id = oe.organization_id AND m.user_id = _user_id AND m.status = 'active'
    JOIN public.organizations o ON o.id = oe.organization_id AND o.status = 'active'
    LEFT JOIN public.exams x ON x.id = _exam_id
    WHERE oe.status = 'active'
      AND oe.starts_at <= now()
      AND (oe.expires_at IS NULL OR oe.expires_at > now())
      AND (
        oe.access_scope = 'all'
        OR (oe.access_scope = 'exam' AND oe.exam_id = _exam_id)
        OR (oe.access_scope = 'certification' AND oe.certification_id = x.certification_id)
      )
  )
$$;