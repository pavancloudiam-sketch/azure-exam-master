-- The earlier REVOKE targeted `anon` directly, but EXECUTE was still held via
-- the implicit PUBLIC grant. Remove it from PUBLIC and re-grant explicitly.
REVOKE EXECUTE ON FUNCTION public.create_certification_version(uuid, text, text, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_certification_version(uuid, text, text, date, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.retire_certification_version(uuid, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retire_certification_version(uuid, date, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.accept_current_legal_documents(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.exam_is_available(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exam_is_available(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_exam_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_exam_access(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.application_settings_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_sso_configuration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.digest_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_content(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_content(text) TO authenticated, service_role;