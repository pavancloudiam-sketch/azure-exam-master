-- =========================================================
-- Phase 4 (prompt 34): subscription, refund, invoice, tax
-- and notification workflows. TEST MODE ONLY - no payment
-- provider is configured and no money can move.
-- =========================================================

-- ---------- Billing profile (India-oriented tax fields) ----------
CREATE TABLE public.billing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  is_business boolean NOT NULL DEFAULT false,
  -- GST number is optional and only meaningful for business buyers.
  -- Applicability/registration is UNCONFIRMED - see launch checklist.
  gstin text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$'),
  address_line1 text,
  address_line2 text,
  city text,
  state_name text,
  state_code text CHECK (state_code IS NULL OR state_code ~ '^[0-9]{2}$'),
  postal_code text,
  country text NOT NULL DEFAULT 'IN' CHECK (country = 'IN'),
  place_of_supply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.billing_profiles TO authenticated;
GRANT ALL ON public.billing_profiles TO service_role;
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own billing profile" ON public.billing_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students insert their own billing profile" ON public.billing_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Students update their own billing profile" ON public.billing_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER billing_profiles_updated_at BEFORE UPDATE ON public.billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- India-oriented fields captured on the invoice document itself.
ALTER TABLE public.invoices
  ADD COLUMN buyer_gstin text,
  ADD COLUMN place_of_supply text,
  ADD COLUMN tax_note text NOT NULL DEFAULT
    'Tax treatment is not configured. This document has not been reviewed by a tax professional.';

-- ---------- Email notification queue ----------
CREATE TABLE public.email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template text NOT NULL CHECK (template IN (
    'purchase_confirmation', 'payment_failure', 'refund_status',
    'exam_reminder', 'result_available'
  )),
  -- One row per logical message. Retries reuse the row, so a retry can
  -- never produce a second email.
  idempotency_key text NOT NULL UNIQUE,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  attempt_id uuid REFERENCES public.attempts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_notifications_user_idx ON public.email_notifications(user_id, created_at DESC);
CREATE INDEX email_notifications_pending_idx
  ON public.email_notifications(scheduled_for) WHERE status = 'queued';
GRANT SELECT ON public.email_notifications TO authenticated;
GRANT ALL ON public.email_notifications TO service_role;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own notifications" ON public.email_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER email_notifications_updated_at BEFORE UPDATE ON public.email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Shared helpers ----------
CREATE OR REPLACE FUNCTION public.log_financial_action(
  _actor_type text, _action text, _entity_type text,
  _entity_id uuid, _entity_label text, _details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.financial_audit_logs
    (actor_id, actor_type, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), _actor_type, _action, _entity_type, _entity_id, _entity_label, _details);
$$;

CREATE OR REPLACE FUNCTION public.enqueue_email_notification(
  _user_id uuid, _template text, _idempotency_key text,
  _subject text, _body text,
  _order_id uuid DEFAULT NULL, _refund_id uuid DEFAULT NULL,
  _exam_id uuid DEFAULT NULL, _attempt_id uuid DEFAULT NULL,
  _scheduled_for timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text; v_id uuid;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = _user_id;
  IF v_email IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.email_notifications
    (user_id, template, idempotency_key, to_email, subject, body,
     order_id, refund_id, exam_id, attempt_id, scheduled_for)
  VALUES (_user_id, _template, _idempotency_key, v_email, _subject, _body,
          _order_id, _refund_id, _exam_id, _attempt_id, _scheduled_for)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------- Refund request workflow ----------
CREATE OR REPLACE FUNCTION public.request_refund(_order_id uuid, _reason text)
RETURNS public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE o public.orders; r public.refunds;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status <> 'paid' THEN RAISE EXCEPTION 'Only paid orders can be refunded'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.refunds
    WHERE order_id = _order_id AND status IN ('requested', 'approved', 'processed')
  ) THEN
    RAISE EXCEPTION 'A refund is already recorded for this order';
  END IF;

  INSERT INTO public.refunds (order_id, user_id, amount_minor, currency, reason, status)
  VALUES (_order_id, auth.uid(), o.total_minor, o.currency, btrim(_reason), 'requested')
  RETURNING * INTO r;

  PERFORM public.log_financial_action(
    'user', 'refund.requested', 'refund', r.id, o.order_number,
    jsonb_build_object('order_id', _order_id, 'amount_minor', r.amount_minor));

  PERFORM public.enqueue_email_notification(
    auth.uid(), 'refund_status', 'refund-' || r.id::text || '-requested',
    'We received your refund request',
    'We have received your refund request for order ' || o.order_number ||
    '. Our team will review it and update you. Reference: ' || r.id::text || '.',
    _order_id, r.id);

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_refund(_refund_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.refunds; v_order_number text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;

  UPDATE public.refunds
  SET status = _decision, decided_by = auth.uid(), decided_at = now(),
      decision_note = NULLIF(btrim(coalesce(_note, '')), '')
  WHERE id = _refund_id AND status = 'requested'
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund request not found or already decided'; END IF;

  SELECT order_number INTO v_order_number FROM public.orders WHERE id = r.order_id;

  PERFORM public.log_financial_action(
    'admin', 'refund.' || _decision, 'refund', r.id, v_order_number,
    jsonb_build_object('note', r.decision_note, 'amount_minor', r.amount_minor));

  PERFORM public.enqueue_email_notification(
    r.user_id, 'refund_status', 'refund-' || r.id::text || '-' || _decision,
    CASE WHEN _decision = 'approved' THEN 'Your refund has been approved'
         ELSE 'Update on your refund request' END,
    'Your refund request for order ' || coalesce(v_order_number, '') || ' was ' || _decision ||
    coalesce('. Note: ' || r.decision_note, '') || '.',
    r.order_id, r.id);

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_refund_processed(_refund_id uuid, _provider_reference text DEFAULT NULL)
RETURNS public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.refunds; v_order_number text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;

  UPDATE public.refunds
  SET status = 'processed', provider_reference = NULLIF(btrim(coalesce(_provider_reference, '')), '')
  WHERE id = _refund_id AND status = 'approved'
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved refund not found'; END IF;

  UPDATE public.orders SET status = 'refunded' WHERE id = r.order_id;
  UPDATE public.invoices SET status = 'void' WHERE order_id = r.order_id AND status <> 'void';

  -- Access bought with this order is withdrawn once the money is returned.
  UPDATE public.entitlements
  SET status = 'revoked', revoked_at = now(), revoke_reason = 'refund_processed'
  WHERE order_id = r.order_id AND status = 'active';

  SELECT order_number INTO v_order_number FROM public.orders WHERE id = r.order_id;

  PERFORM public.log_financial_action(
    'admin', 'refund.processed', 'refund', r.id, v_order_number,
    jsonb_build_object('amount_minor', r.amount_minor, 'provider_reference', r.provider_reference));

  PERFORM public.enqueue_email_notification(
    r.user_id, 'refund_status', 'refund-' || r.id::text || '-processed',
    'Your refund has been processed',
    'Your refund for order ' || coalesce(v_order_number, '') ||
    ' has been marked as processed. Any access granted by this order has been removed.',
    r.order_id, r.id);

  RETURN r;
END;
$$;

-- ---------- Subscription cancellation & expiry ----------
CREATE OR REPLACE FUNCTION public.request_subscription_cancellation(_subscription_id uuid, _reason text DEFAULT NULL)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s public.subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.subscriptions
  SET cancel_at_period_end = true
  WHERE id = _subscription_id AND user_id = auth.uid() AND status IN ('active', 'past_due')
  RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active subscription not found'; END IF;

  PERFORM public.log_financial_action(
    'user', 'subscription.cancellation_requested', 'subscription', s.id, NULL,
    jsonb_build_object('reason', NULLIF(btrim(coalesce(_reason, '')), ''),
                       'period_end', s.current_period_end));
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_subscription_cancellation(_subscription_id uuid)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s public.subscriptions;
BEGIN
  UPDATE public.subscriptions SET cancel_at_period_end = false
  WHERE id = _subscription_id AND user_id = auth.uid() AND status IN ('active', 'past_due')
  RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active subscription not found'; END IF;

  PERFORM public.log_financial_action(
    'user', 'subscription.cancellation_withdrawn', 'subscription', s.id, NULL, '{}'::jsonb);
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(_subscription_id uuid, _note text DEFAULT NULL)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s public.subscriptions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;

  UPDATE public.subscriptions
  SET status = 'cancelled', cancelled_at = now(), cancel_at_period_end = false
  WHERE id = _subscription_id AND status <> 'cancelled'
  RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;

  UPDATE public.entitlements
  SET status = 'revoked', revoked_at = now(), revoke_reason = 'subscription_cancelled'
  WHERE subscription_id = s.id AND status = 'active';

  PERFORM public.log_financial_action(
    'admin', 'subscription.cancelled', 'subscription', s.id, NULL,
    jsonb_build_object('note', NULLIF(btrim(coalesce(_note, '')), '')));
  RETURN s;
END;
$$;

-- Expires time-limited access and finished subscriptions. Runs on a schedule.
CREATE OR REPLACE FUNCTION public.expire_due_access()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ent integer; v_sub integer; v_sub_ent integer;
BEGIN
  UPDATE public.entitlements
  SET status = 'expired'
  WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now();
  GET DIAGNOSTICS v_ent = ROW_COUNT;

  UPDATE public.subscriptions
  SET status = 'expired', cancelled_at = coalesce(cancelled_at, now())
  WHERE status IN ('active', 'past_due')
    AND current_period_end IS NOT NULL
    AND current_period_end <= now()
    AND cancel_at_period_end;
  GET DIAGNOSTICS v_sub = ROW_COUNT;

  UPDATE public.entitlements e
  SET status = 'expired'
  WHERE e.status = 'active'
    AND e.subscription_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = e.subscription_id AND s.status IN ('expired', 'cancelled'));
  GET DIAGNOSTICS v_sub_ent = ROW_COUNT;

  RETURN jsonb_build_object(
    'entitlements_expired', v_ent,
    'subscriptions_expired', v_sub,
    'subscription_entitlements_expired', v_sub_ent);
END;
$$;

-- ---------- Student-triggered notifications ----------
CREATE OR REPLACE FUNCTION public.request_exam_reminder(_exam_id uuid, _remind_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_title text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _remind_at <= now() THEN RAISE EXCEPTION 'Choose a future date and time'; END IF;
  IF _remind_at > now() + interval '180 days' THEN RAISE EXCEPTION 'Reminders are limited to 180 days ahead'; END IF;

  SELECT title INTO v_title FROM public.exams WHERE id = _exam_id AND is_published;
  IF v_title IS NULL THEN RAISE EXCEPTION 'Exam not found'; END IF;

  SELECT public.enqueue_email_notification(
    auth.uid(), 'exam_reminder',
    'reminder-' || auth.uid()::text || '-' || _exam_id::text || '-' ||
      to_char(_remind_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI'),
    'Reminder: ' || v_title,
    'This is your AskMeExam practice reminder for "' || v_title || '". Sign in to start your attempt.',
    NULL, NULL, _exam_id, NULL, _remind_at)
  INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_result_available(_attempt_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a public.attempts; v_title text; v_id uuid;
BEGIN
  SELECT * INTO a FROM public.attempts WHERE id = _attempt_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.status <> 'submitted' THEN RETURN NULL; END IF;

  SELECT title INTO v_title FROM public.exams WHERE id = a.exam_id;

  SELECT public.enqueue_email_notification(
    a.user_id, 'result_available', 'result-' || a.id::text,
    'Your AskMeExam result is ready',
    'Your result for "' || coalesce(v_title, 'your practice exam') ||
    '" is available in AskMeExam. This is an AskMeExam practice result, not a Microsoft credential.',
    NULL, NULL, a.exam_id, a.id)
  INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------- Notification delivery (test mode) ----------
-- Test mode records delivery instead of contacting a mail provider. Retrying
-- an already-sent message is a no-op, so retries never duplicate an email.
CREATE OR REPLACE FUNCTION public.mark_notification_sent(_notification_id uuid, _error text DEFAULT NULL)
RETURNS public.email_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n public.email_notifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;

  SELECT * INTO n FROM public.email_notifications WHERE id = _notification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found'; END IF;
  IF n.status = 'sent' THEN RETURN n; END IF;

  UPDATE public.email_notifications
  SET status = CASE WHEN _error IS NULL THEN 'sent' ELSE 'failed' END,
      attempts = attempts + 1,
      sent_at = CASE WHEN _error IS NULL THEN now() ELSE sent_at END,
      last_error = _error
  WHERE id = _notification_id
  RETURNING * INTO n;

  RETURN n;
END;
$$;

-- ---------- Test-mode order simulation ----------
CREATE OR REPLACE FUNCTION public.admin_create_test_order(
  _user_id uuid, _product_id uuid, _outcome text DEFAULT 'paid'
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.products; pr public.prices; o public.orders; inv public.invoices;
  sub public.subscriptions; bp public.billing_profiles;
  v_number text; v_expires timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF _outcome NOT IN ('paid', 'failed') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;

  SELECT * INTO p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  SELECT * INTO pr FROM public.prices WHERE product_id = p.id AND is_active ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product has no active price'; END IF;

  v_number := 'TEST-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

  INSERT INTO public.orders (user_id, order_number, status, subtotal_minor, total_minor,
                             placed_at, paid_at, notes)
  VALUES (_user_id, v_number,
          CASE WHEN _outcome = 'paid' THEN 'paid' ELSE 'failed' END,
          pr.amount_minor, pr.amount_minor, now(),
          CASE WHEN _outcome = 'paid' THEN now() END,
          'Test-mode order. No money was collected.')
  RETURNING * INTO o;

  INSERT INTO public.order_items (order_id, product_id, price_id, product_name,
                                  unit_amount_minor, total_minor)
  VALUES (o.id, p.id, pr.id, p.name, pr.amount_minor, pr.amount_minor);

  INSERT INTO public.payment_attempts (order_id, user_id, provider, status, amount_minor,
                                       failure_code, failure_message, metadata)
  VALUES (o.id, _user_id, 'test_mode',
          CASE WHEN _outcome = 'paid' THEN 'succeeded' ELSE 'failed' END,
          pr.amount_minor,
          CASE WHEN _outcome = 'failed' THEN 'test_declined' END,
          CASE WHEN _outcome = 'failed' THEN 'Simulated payment failure (test mode).' END,
          jsonb_build_object('test_mode', true));

  IF _outcome = 'failed' THEN
    PERFORM public.log_financial_action('admin', 'order.payment_failed', 'order', o.id, v_number,
      jsonb_build_object('test_mode', true));
    PERFORM public.enqueue_email_notification(
      _user_id, 'payment_failure', 'payment-failed-' || o.id::text,
      'We could not process your payment',
      'Your payment for order ' || v_number || ' did not go through, so no access was granted. ' ||
      'No amount has been charged. You can try again from your purchases page.', o.id);
    RETURN o;
  END IF;

  SELECT * INTO bp FROM public.billing_profiles WHERE user_id = _user_id;

  INSERT INTO public.invoices (order_id, user_id, invoice_number, status,
                               subtotal_minor, total_minor, issued_at,
                               buyer_gstin, place_of_supply,
                               seller_details, buyer_details)
  VALUES (o.id, _user_id, 'AMEX-INV-' || substr(v_number, 6), 'issued',
          pr.amount_minor, pr.amount_minor, now(),
          bp.gstin, coalesce(bp.place_of_supply, bp.state_name),
          jsonb_build_object('name', 'AskMeExam', 'country', 'IN',
                             'note', 'Seller registration details pending professional review.'),
          jsonb_build_object('legal_name', coalesce(bp.legal_name, ''),
                             'address_line1', coalesce(bp.address_line1, ''),
                             'city', coalesce(bp.city, ''),
                             'state_name', coalesce(bp.state_name, ''),
                             'postal_code', coalesce(bp.postal_code, '')))
  RETURNING * INTO inv;

  v_expires := CASE WHEN p.access_days IS NOT NULL
                    THEN now() + make_interval(days => p.access_days) END;

  IF p.product_type = 'subscription' THEN
    INSERT INTO public.subscriptions (user_id, product_id, price_id, status,
                                      current_period_start, current_period_end, provider)
    VALUES (_user_id, p.id, pr.id, 'active', now(),
            now() + make_interval(months =>
              CASE WHEN pr.billing_interval = 'year' THEN 12 * pr.interval_count
                   ELSE pr.interval_count END),
            'test_mode')
    RETURNING * INTO sub;
    v_expires := sub.current_period_end;
  END IF;

  INSERT INTO public.entitlements (user_id, product_id, source, order_id, subscription_id,
                                   access_scope, exam_id, certification_id, expires_at, granted_by)
  VALUES (_user_id, p.id,
          CASE WHEN sub.id IS NOT NULL THEN 'subscription' ELSE 'order' END,
          o.id, sub.id, p.access_scope, p.exam_id, p.certification_id, v_expires, auth.uid());

  PERFORM public.log_financial_action('admin', 'order.paid', 'order', o.id, v_number,
    jsonb_build_object('test_mode', true, 'amount_minor', pr.amount_minor));
  PERFORM public.log_financial_action('admin', 'invoice.issued', 'invoice', inv.id,
    inv.invoice_number, jsonb_build_object('test_mode', true));

  PERFORM public.enqueue_email_notification(
    _user_id, 'purchase_confirmation', 'purchase-' || o.id::text,
    'Your AskMeExam purchase is confirmed',
    'Thank you. Order ' || v_number || ' is confirmed and your access is now active. ' ||
    'Invoice ' || inv.invoice_number || ' is available on your purchases page. ' ||
    'AskMeExam practice materials and certificates are issued by AskMeExam and are not Microsoft credentials.',
    o.id);

  RETURN o;
END;
$$;

-- ---------- Scheduled expiry ----------
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('askmeexam-expire-due-access', '7 * * * *',
  $$SELECT public.expire_due_access();$$);
