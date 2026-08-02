REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, public.org_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_org_exam_access(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, public.org_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_exam_access(uuid, uuid) TO authenticated;