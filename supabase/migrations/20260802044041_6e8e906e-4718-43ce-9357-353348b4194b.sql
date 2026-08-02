DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
CREATE POLICY "Anon reads active products"
  ON public.products FOR SELECT TO anon USING (is_active);
CREATE POLICY "Users read active products"
  ON public.products FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can read active prices" ON public.prices;
CREATE POLICY "Anon reads active prices"
  ON public.prices FOR SELECT TO anon USING (is_active);
CREATE POLICY "Users read active prices"
  ON public.prices FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can read legal documents" ON public.legal_documents;
CREATE POLICY "Anon reads legal documents"
  ON public.legal_documents FOR SELECT TO anon USING (true);
CREATE POLICY "Users read legal documents"
  ON public.legal_documents FOR SELECT TO authenticated USING (true);