REVOKE EXECUTE ON FUNCTION public.upsert_organization_sso(uuid, text, text, text[], text[], text, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_api_key(uuid, text, text[], integer, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_organization_api_key(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_webhook(uuid, text, text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_organization_webhook_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_organization_webhooks(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_organization_sso(uuid, text, text, text[], text[], text, text, text, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_organization_api_key(uuid, text, text[], integer, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_organization_api_key(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_organization_webhook(uuid, text, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_organization_webhook_status(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_organization_webhooks(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_webhook_event(uuid, text, text, jsonb) TO service_role;