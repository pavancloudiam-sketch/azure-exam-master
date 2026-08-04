-- 1. Lock down SECURITY DEFINER functions
DO $$
DECLARE
  f record;
  anon_keep text[] := ARRAY['get_public_certifications','get_public_pricing','get_branding_for_domain','get_effective_price'];
  auth_revoke text[] := ARRAY[
    'allocate_blueprint_domains','apply_retention_policies','attempt_item_set',
    'enqueue_email_notification','enqueue_webhook_event','expire_due_access',
    'expire_stale_upi_orders','grant_admin_role','revoke_admin_role',
    'log_financial_action','options_fingerprint','select_attempt_questions',
    'run_nightly_retention','settle_upi_payment','fail_upi_payment',
    'complete_payment_webhook','claim_email_jobs','claim_webhook_jobs',
    'complete_email_job','complete_webhook_job','digest_secret',
    'execute_account_deletion','execute_organization_deletion',
    'admin_cancel_subscription','sync_entitlement_targets'
  ];
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.prorettype = 'trigger'::regtype AS is_trigger,
           format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    IF NOT (f.proname = ANY(anon_keep)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
    END IF;
    IF f.is_trigger OR f.proname = ANY(auth_revoke) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- 2. Hide questions.explanation from the Data API
REVOKE ALL ON TABLE public.questions FROM anon;
REVOKE ALL ON TABLE public.questions FROM authenticated;
GRANT SELECT (id, exam_id, topic_id, stem, question_type, sort_order, created_at, updated_at,
  certification_id, scenario, difficulty, points, is_active, tags, governance_status,
  is_archived, review_flag, import_batch_id, scoring_method, is_pilot_eligible,
  source_page, case_study_id) ON public.questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;