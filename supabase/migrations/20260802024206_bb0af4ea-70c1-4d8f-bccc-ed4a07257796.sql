-- =========================================================
-- Phase 4: commercial data model + legal consent foundation
-- Launch jurisdiction: India. Money stored in paise (INR).
-- No payment provider is activated by this migration.
-- =========================================================

-- ---------- Products & prices ----------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  product_type text NOT NULL CHECK (product_type IN ('one_time_exam', 'subscription')),
  access_scope text NOT NULL DEFAULT 'exam' CHECK (access_scope IN ('exam', 'certification', 'all')),
  certification_id uuid REFERENCES public.certifications(id),
  exam_id uuid REFERENCES public.exams(id),
  access_days integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active products" ON public.products
  FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update products" ON public.products
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  billing_interval text CHECK (billing_interval IN ('month', 'year')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prices_product_idx ON public.prices(product_id) WHERE is_active;
GRANT SELECT ON public.prices TO anon, authenticated;
GRANT INSERT, UPDATE ON public.prices TO authenticated;
GRANT ALL ON public.prices TO service_role;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active prices" ON public.prices
  FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert prices" ON public.prices
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update prices" ON public.prices
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- Coupons ----------
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  max_redemptions integer,
  per_user_limit integer NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  redemption_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT INSERT, UPDATE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read active coupons" ON public.coupons
  FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert coupons" ON public.coupons
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update coupons" ON public.coupons
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- Orders ----------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_payment', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  subtotal_minor integer NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  discount_minor integer NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  -- Tax is captured but NOT computed. GST applicability is unconfirmed (see launch checklist).
  tax_minor integer NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor integer NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  coupon_id uuid REFERENCES public.coupons(id),
  placed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created_idx ON public.orders(user_id, created_at DESC);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  price_id uuid NOT NULL REFERENCES public.prices(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_minor integer NOT NULL CHECK (unit_amount_minor >= 0),
  total_minor integer NOT NULL CHECK (total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own order items" ON public.order_items
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

-- ---------- Payment attempts ----------
CREATE TABLE public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL DEFAULT 'unconfigured',
  provider_reference text,
  method text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'succeeded', 'failed', 'cancelled')),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  failure_code text,
  failure_message text,
  -- Never store card data or gateway secrets here.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_attempts_order_idx ON public.payment_attempts(order_id, created_at DESC);
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own payment attempts" ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------- Refunds ----------
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_attempt_id uuid REFERENCES public.payment_attempts(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'processed', 'failed')),
  provider_reference text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_user_idx ON public.refunds(user_id, created_at DESC);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own refunds" ON public.refunds
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage refunds" ON public.refunds
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- Invoices ----------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  subtotal_minor integer NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  discount_minor integer NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor integer NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor integer NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  -- Placeholder only: GST applicability, rates and registration are unconfirmed.
  tax_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user_idx ON public.invoices(user_id, created_at DESC);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------- Coupon redemptions ----------
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_minor integer NOT NULL CHECK (discount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coupon_redemptions_coupon_idx ON public.coupon_redemptions(coupon_id, user_id);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------- Subscriptions ----------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  price_id uuid NOT NULL REFERENCES public.prices(id),
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  provider text NOT NULL DEFAULT 'unconfigured',
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id, status);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------- Entitlements ----------
CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid REFERENCES public.products(id),
  source text NOT NULL CHECK (source IN ('order', 'subscription', 'manual_grant', 'promotional')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  access_scope text NOT NULL CHECK (access_scope IN ('exam', 'certification', 'all')),
  exam_id uuid REFERENCES public.exams(id),
  certification_id uuid REFERENCES public.certifications(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entitlements_user_status_idx ON public.entitlements(user_id, status);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own entitlements" ON public.entitlements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Access check used by future paid-content gating. Entitlements are never
-- written from the browser, so this can be trusted as the access source.
CREATE OR REPLACE FUNCTION public.has_exam_access(_user_id uuid, _exam_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.entitlements e
    LEFT JOIN public.exams x ON x.id = _exam_id
    WHERE e.user_id = _user_id
      AND e.status = 'active'
      AND e.starts_at <= now()
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND (
        e.access_scope = 'all'
        OR (e.access_scope = 'exam' AND e.exam_id = _exam_id)
        OR (e.access_scope = 'certification' AND e.certification_id = x.certification_id)
      )
  )
$$;

-- ---------- Legal documents & acceptance ----------
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('terms_of_service', 'privacy_policy', 'refund_policy')),
  version text NOT NULL,
  title text NOT NULL,
  summary text,
  body text NOT NULL,
  is_placeholder boolean NOT NULL DEFAULT true,
  is_current boolean NOT NULL DEFAULT false,
  effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version)
);
CREATE UNIQUE INDEX legal_documents_one_current_idx
  ON public.legal_documents(doc_type) WHERE is_current;
GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT INSERT, UPDATE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read legal documents" ON public.legal_documents
  FOR SELECT USING (true);
CREATE POLICY "Admins insert legal documents" ON public.legal_documents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update legal documents" ON public.legal_documents
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id),
  doc_type text NOT NULL,
  version text NOT NULL,
  context text NOT NULL DEFAULT 'registration'
    CHECK (context IN ('registration', 'checkout', 'reacceptance')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id, context)
);
CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances(user_id);
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students record their own acceptances" ON public.legal_acceptances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Records acceptance of the current version of a policy for the signed-in user.
CREATE OR REPLACE FUNCTION public.accept_current_legal_documents(_context text DEFAULT 'registration')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE inserted integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _context NOT IN ('registration', 'checkout', 'reacceptance') THEN
    RAISE EXCEPTION 'Invalid acceptance context';
  END IF;

  INSERT INTO public.legal_acceptances (user_id, document_id, doc_type, version, context)
  SELECT auth.uid(), d.id, d.doc_type, d.version, _context
  FROM public.legal_documents d
  WHERE d.is_current
  ON CONFLICT (user_id, document_id, context) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- ---------- Financial audit log ----------
CREATE TABLE public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'admin', 'system')),
  action text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN (
    'product', 'price', 'order', 'payment_attempt', 'refund',
    'invoice', 'coupon', 'entitlement', 'subscription', 'legal_document'
  )),
  entity_id uuid,
  entity_label text,
  amount_minor integer,
  currency text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX financial_audit_logs_created_idx ON public.financial_audit_logs(created_at DESC);
GRANT SELECT ON public.financial_audit_logs TO authenticated;
GRANT ALL ON public.financial_audit_logs TO service_role;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read the financial audit log" ON public.financial_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- updated_at triggers ----------
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER prices_updated_at BEFORE UPDATE ON public.prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER entitlements_updated_at BEFORE UPDATE ON public.entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER legal_documents_updated_at BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Starter catalogue & legal placeholders ----------
INSERT INTO public.products (code, name, description, product_type, access_scope, certification_id, access_days, sort_order, is_active)
SELECT 'entra-exam-access', 'Microsoft Entra ID practice exam access',
       'One-time access to the Microsoft Entra ID practice exam library for 180 days.',
       'one_time_exam', 'certification', c.id, 180, 1, true
FROM public.certifications c WHERE c.code = 'SC-300' LIMIT 1;

INSERT INTO public.products (code, name, description, product_type, access_scope, access_days, sort_order, is_active)
VALUES
  ('askme-monthly', 'AskMeExam Monthly', 'Full access to all practice exams and AskMe AI while the plan is active.', 'subscription', 'all', NULL, 2, true),
  ('askme-annual', 'AskMeExam Annual', 'Full access to all practice exams and AskMe AI for twelve months.', 'subscription', 'all', NULL, 3, true);

INSERT INTO public.prices (product_id, amount_minor, billing_interval, is_active)
SELECT p.id, 149900, NULL, true FROM public.products p WHERE p.code = 'entra-exam-access';
INSERT INTO public.prices (product_id, amount_minor, billing_interval, is_active)
SELECT p.id, 79900, 'month', true FROM public.products p WHERE p.code = 'askme-monthly';
INSERT INTO public.prices (product_id, amount_minor, billing_interval, is_active)
SELECT p.id, 699900, 'year', true FROM public.products p WHERE p.code = 'askme-annual';

INSERT INTO public.coupons (code, description, discount_type, discount_value, per_user_limit, is_active)
VALUES ('LAUNCH20', 'Launch discount — 20% off any plan.', 'percent', 20, 1, true);

INSERT INTO public.legal_documents (doc_type, version, title, summary, body, is_placeholder, is_current, effective_at)
VALUES
 ('terms_of_service', 'draft-0.1', 'Terms of Service (placeholder draft)',
  'Placeholder draft. Not reviewed by a lawyer and not a substitute for legal advice.',
  E'PLACEHOLDER DRAFT — NOT LEGAL ADVICE\n\nThis document is a structural placeholder so that acceptance can be captured and versioned. It has not been reviewed by a qualified lawyer and must be replaced before any commercial launch.\n\n1. Service. AskMeExam provides independent certification practice material. AskMeExam is not affiliated with, endorsed by, or certified by Microsoft.\n\n2. Accounts. You are responsible for your account credentials and for the accuracy of the information you provide.\n\n3. Acceptable use. Practice content is for personal study. Copying, redistributing or reselling question content is not permitted.\n\n4. No guarantee of outcome. Practice scores are indicative only and do not predict or guarantee any certification result.\n\n5. Purchases. Paid access, where offered, is governed by the Refund Policy. Pricing, taxes and invoicing terms are pending professional confirmation for the India launch jurisdiction.\n\n6. Changes. These terms may be updated; the current version and its acceptance date are recorded against your account.\n\n[TO BE COMPLETED BY A QUALIFIED LAWYER: liability, indemnity, governing law and dispute resolution, termination, consumer-protection disclosures.]',
  true, true, NULL),
 ('privacy_policy', 'draft-0.1', 'Privacy Policy (placeholder draft)',
  'Placeholder draft. Not reviewed by a lawyer and not a substitute for legal advice.',
  E'PLACEHOLDER DRAFT — NOT LEGAL ADVICE\n\nThis document is a structural placeholder. It has not been reviewed by a qualified privacy practitioner and must be replaced before any commercial launch.\n\n1. What we hold. Account email and name, exam attempts and scores, and — where you choose to save it — AskMe AI interview history.\n\n2. Why. To operate your account, deliver practice exams, and record purchases and access rights.\n\n3. Processors. Hosting, database, authentication and AI model providers process data on our behalf. A full processor list is to be published before launch.\n\n4. AI features. AskMe AI requests avoid sending unnecessary personal information. Prompts and completions are not stored in usage logs.\n\n5. Retention and your rights. Retention periods and the process for access, correction and deletion requests are to be confirmed.\n\n[TO BE COMPLETED BY A QUALIFIED PRACTITIONER: lawful basis, DPDP Act obligations, consent notices, grievance officer details, breach notification, cross-border transfer position.]',
  true, true, NULL),
 ('refund_policy', 'draft-0.1', 'Refund Policy (placeholder draft)',
  'Placeholder draft. Not reviewed by a lawyer and not a substitute for legal advice.',
  E'PLACEHOLDER DRAFT — NOT LEGAL ADVICE\n\nThis document is a structural placeholder. It has not been reviewed by a qualified lawyer and must be replaced before any commercial launch.\n\n1. Scope. Applies to paid access purchased directly from AskMeExam once payments are activated. No payments are currently accepted.\n\n2. Intended approach. A refund window from the purchase date, reduced or unavailable once substantial practice content has been consumed.\n\n3. How to request. Refund requests are recorded against the original order and reviewed by an administrator; decisions and reasons are recorded.\n\n4. Processing. Approved refunds are returned to the original payment method. Timelines depend on the payment provider.\n\n[TO BE COMPLETED BY A QUALIFIED LAWYER: statutory cancellation rights, consumer-protection obligations for digital goods in India, chargeback handling, provider-specific timelines.]',
  true, true, NULL);