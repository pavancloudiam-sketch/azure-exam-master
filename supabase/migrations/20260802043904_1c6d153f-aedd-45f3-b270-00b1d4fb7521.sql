-- ===========================================================================
-- Prompt 14 recovery: permissions and data-exposure re-audit fixes
-- ===========================================================================

-- 1. Right-size Data API grants on tables added after the original audit.
DO $$
DECLARE
  t text;
  newer text[] := ARRAY[
    'account_deletion_requests','ai_content_reports','ai_feature_flags',
    'ai_interview_sessions','ai_interview_turns','ai_usage_logs','api_request_logs',
    'application_settings','billing_profiles','coupon_redemptions','coupons',
    'data_export_requests','email_notifications','entitlements','financial_audit_logs',
    'import_batches','import_staged_rows','invoices','legal_acceptances','legal_documents',
    'order_items','orders','organization_api_keys','organization_deletion_requests',
    'organization_entitlements','organization_members','organization_roles',
    'organization_settings','organization_sso_configurations','organization_webhooks',
    'organizations','payment_attempts','prices','products','refunds','retention_policies',
    'scim_provisioning_tokens','subscriptions','webhook_deliveries','webhook_events'
  ];
BEGIN
  FOREACH t IN ARRAY newer LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Read-only for the signed-in owner / tenant member (policies scope the rows).
GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT SELECT ON public.data_export_requests TO authenticated;
GRANT SELECT ON public.email_notifications TO authenticated;
GRANT SELECT ON public.entitlements TO authenticated;
GRANT SELECT ON public.financial_audit_logs TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.organization_api_keys TO authenticated;
GRANT SELECT ON public.organization_deletion_requests TO authenticated;
GRANT SELECT ON public.organization_entitlements TO authenticated;
GRANT SELECT ON public.organization_webhooks TO authenticated;
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT SELECT ON public.retention_policies TO authenticated;
GRANT SELECT ON public.scim_provisioning_tokens TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT SELECT ON public.webhook_events TO authenticated;

-- Read + the specific writes an existing policy allows.
GRANT SELECT, INSERT, UPDATE ON public.ai_content_reports TO authenticated;
GRANT SELECT, UPDATE ON public.ai_feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_interview_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_interview_turns TO authenticated;
GRANT SELECT, UPDATE ON public.application_settings TO authenticated;
GRANT SELECT ON public.application_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.billing_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_staged_rows TO authenticated;
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.legal_documents TO authenticated;
GRANT SELECT ON public.legal_documents TO anon;
GRANT SELECT, INSERT, UPDATE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.organization_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_sso_configurations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prices TO authenticated;
GRANT SELECT ON public.prices TO anon;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT SELECT, UPDATE ON public.refunds TO authenticated;

-- 2. Never expose credential material through the Data API.
REVOKE SELECT (key_hash) ON public.organization_api_keys FROM authenticated, anon;
REVOKE SELECT (token_hash) ON public.scim_provisioning_tokens FROM authenticated, anon;
REVOKE SELECT (secret) ON public.organization_webhooks FROM authenticated, anon;

-- 3. API keys and API request logs are administrative, not member-wide.
DROP POLICY IF EXISTS "api keys readable inside the tenant" ON public.organization_api_keys;
CREATE POLICY "api keys readable by org admins"
  ON public.organization_api_keys FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "api logs readable inside the tenant" ON public.api_request_logs;
CREATE POLICY "api logs readable by org admins"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sso readable inside the tenant" ON public.organization_sso_configurations;
CREATE POLICY "sso readable by org admins"
  ON public.organization_sso_configurations FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- 4. Remove privileges with no backing policy on the original tables.
REVOKE DELETE ON public.attempts, public.attempt_answers, public.audit_logs,
  public.profiles FROM authenticated, anon;

-- 5. Anonymous callers must not execute application routines.
REVOKE EXECUTE ON FUNCTION public.create_certification_version(uuid, text, text, date, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retire_certification_version(uuid, date, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_current_legal_documents(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exam_is_available(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_exam_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.digest_secret(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_content(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.application_settings_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_sso_configuration() FROM anon, authenticated;