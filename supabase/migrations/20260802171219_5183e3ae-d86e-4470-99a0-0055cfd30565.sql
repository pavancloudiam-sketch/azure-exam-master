create extension if not exists btree_gist;

-- The audit log gains a promotion category.
alter table public.financial_audit_logs drop constraint if exists financial_audit_logs_entity_type_check;
alter table public.financial_audit_logs add constraint financial_audit_logs_entity_type_check
  check (entity_type = any (array['product','price','promotion','order','payment_attempt','refund',
                                  'invoice','coupon','entitlement','subscription','legal_document']));

-- ---------------------------------------------------------------- promotions
create table if not exists public.price_promotions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  description text,
  currency text not null default 'INR' check (currency = 'INR'),
  promo_amount_minor integer not null check (promo_amount_minor >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'Asia/Kolkata',
  is_active boolean not null default false,
  allow_coupon_stacking boolean not null default false,
  priority integer not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_promotions_window check (ends_at > starts_at)
);

grant select, insert, update on public.price_promotions to authenticated;
grant select on public.price_promotions to anon;
grant all on public.price_promotions to service_role;

alter table public.price_promotions enable row level security;

create policy "Anon reads live promotions" on public.price_promotions
  for select to anon
  using (is_active and starts_at <= now() and ends_at > now());

create policy "Users read live promotions" on public.price_promotions
  for select to authenticated
  using ((is_active and starts_at <= now() and ends_at > now()) or public.has_role(auth.uid(), 'admin'));

create policy "Admins insert promotions" on public.price_promotions
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update promotions" on public.price_promotions
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger price_promotions_updated_at before update on public.price_promotions
  for each row execute function public.set_updated_at();

-- No two active promotions may cover the same product at the same priority.
alter table public.price_promotions
  add constraint price_promotions_no_overlap
  exclude using gist (
    product_id with =,
    priority with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (is_active);

-- Validation that a CHECK constraint cannot express (needs the product price).
create or replace function public.validate_price_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_regular integer;
begin
  select amount_minor into v_regular
  from public.prices
  where product_id = new.product_id and is_active
  order by created_at limit 1;
  if v_regular is null then
    raise exception 'The product has no active price to discount';
  end if;
  if new.promo_amount_minor >= v_regular then
    raise exception 'The promotional price must be lower than the regular price';
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by); end if;
  return new;
end;
$$;

create trigger price_promotions_validate before insert or update on public.price_promotions
  for each row execute function public.validate_price_promotion();

create or replace function public.audit_price_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_financial_action(
    'admin',
    case when tg_op = 'INSERT' then 'promotion.created' else 'promotion.updated' end,
    'promotion', new.id, new.name,
    jsonb_build_object(
      'product_id', new.product_id,
      'promo_amount_minor', new.promo_amount_minor,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at,
      'is_active', new.is_active,
      'allow_coupon_stacking', new.allow_coupon_stacking,
      'time_zone', new.time_zone));
  return new;
end;
$$;

create trigger price_promotions_audit after insert or update on public.price_promotions
  for each row execute function public.audit_price_promotion();

-- Promotions referenced by real orders are historical records, not disposable rows.
create or replace function public.protect_used_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders where promotion_id = old.id) then
    raise exception 'This promotion is used by existing orders and cannot be deleted. Deactivate it instead.';
  end if;
  return old;
end;
$$;

create trigger price_promotions_protect before delete on public.price_promotions
  for each row execute function public.protect_used_promotion();

-- ------------------------------------------------------------ order snapshot
alter table public.orders
  add column if not exists regular_subtotal_minor integer not null default 0,
  add column if not exists promotion_discount_minor integer not null default 0,
  add column if not exists coupon_discount_minor integer not null default 0,
  add column if not exists promotion_id uuid references public.price_promotions(id),
  add column if not exists price_id uuid references public.prices(id);

create index if not exists orders_promotion_idx on public.orders (promotion_id) where promotion_id is not null;

-- --------------------------------------------------------- price calculation
create or replace function public.get_effective_price(_product_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with pr as (
    select * from public.prices
    where product_id = _product_id and is_active
    order by created_at limit 1
  ), promo as (
    select pp.* from public.price_promotions pp
    where pp.product_id = _product_id and pp.is_active
      and pp.starts_at <= now() and pp.ends_at > now()
    order by pp.priority desc, pp.created_at desc limit 1
  ), upcoming as (
    select pp.* from public.price_promotions pp
    where pp.product_id = _product_id and pp.is_active and pp.starts_at > now()
    order by pp.starts_at limit 1
  )
  select jsonb_build_object(
    'product_id', _product_id,
    'price_id', pr.id,
    'currency', coalesce(pr.currency, 'INR'),
    'regular_minor', pr.amount_minor,
    'promotion_active', promo.id is not null,
    'promotion_id', promo.id,
    'promotion_name', promo.name,
    'promotion_minor', promo.promo_amount_minor,
    'promotion_discount_minor', coalesce(pr.amount_minor - promo.promo_amount_minor, 0),
    'promotion_starts_at', promo.starts_at,
    'promotion_ends_at', promo.ends_at,
    'time_zone', coalesce(promo.time_zone, upcoming.time_zone, 'Asia/Kolkata'),
    'allow_coupon_stacking', coalesce(promo.allow_coupon_stacking, false),
    'upcoming_promotion_starts_at', upcoming.starts_at,
    'final_minor', coalesce(promo.promo_amount_minor, pr.amount_minor),
    'server_now', now()
  )
  from pr left join promo on true left join upcoming on true;
$$;

revoke all on function public.get_effective_price(uuid) from public;
grant execute on function public.get_effective_price(uuid) to anon, authenticated, service_role;

-- Public catalogue with server-calculated pricing for the pricing page.
create or replace function public.get_public_pricing()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.sort_order), '[]'::jsonb)
  from (
    select p.id as product_id, p.code, p.name, p.description, p.product_type,
           p.access_scope, p.access_days, p.sort_order,
           pr.billing_interval, pr.interval_count,
           public.get_effective_price(p.id) as pricing
    from public.products p
    join public.prices pr on pr.product_id = p.id and pr.is_active
    where p.is_active
  ) t;
$$;

revoke all on function public.get_public_pricing() from public;
grant execute on function public.get_public_pricing() to anon, authenticated, service_role;

-- Coupon evaluation. Promotional pricing and coupons are separate systems;
-- the stacking rule lives on the promotion, never on the browser.
create or replace function public.evaluate_purchase_price(_product_id uuid, _coupon_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  eff jsonb := public.get_effective_price(_product_id);
  c public.coupons;
  uid uuid := auth.uid();
  v_regular integer;
  v_promo_final integer;
  v_coupon_discount integer := 0;
  v_coupon_final integer;
  v_final integer;
  v_message text := null;
  v_coupon_id uuid := null;
  v_floor integer;
begin
  if eff is null or eff->>'price_id' is null then
    raise exception 'Product has no active price';
  end if;
  v_regular := (eff->>'regular_minor')::int;
  v_promo_final := (eff->>'final_minor')::int;
  v_final := v_promo_final;
  v_floor := case when v_regular > 0 then 100 else 0 end;

  if _coupon_code is not null and length(btrim(_coupon_code)) > 0 then
    select * into c from public.coupons where upper(code) = upper(btrim(_coupon_code));
    if not found or not c.is_active
       or (c.starts_at is not null and c.starts_at > now())
       or (c.ends_at is not null and c.ends_at <= now()) then
      v_message := 'This coupon code is not valid.';
    elsif c.max_redemptions is not null and c.redemption_count >= c.max_redemptions then
      v_message := 'This coupon has reached its redemption limit.';
    elsif uid is not null and (
      select count(*) from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = uid
    ) >= c.per_user_limit then
      v_message := 'You have already used this coupon.';
    else
      v_coupon_discount := case
        when c.discount_type = 'percent' then (v_regular * c.discount_value) / 100
        else c.discount_value end;
      v_coupon_final := greatest(v_regular - v_coupon_discount, v_floor);

      if (eff->>'promotion_active')::boolean and not (eff->>'allow_coupon_stacking')::boolean then
        -- Policy: not combinable. The student keeps whichever valid price is lower.
        v_message := 'This coupon cannot be combined with the current launch offer.';
        if v_coupon_final < v_promo_final then
          v_final := v_coupon_final;
          v_coupon_id := c.id;
          v_message := 'This coupon cannot be combined with the current launch offer. '
                    || 'The coupon gives a lower price, so it has been applied instead.';
        end if;
      else
        v_final := greatest(v_promo_final - v_coupon_discount, v_floor);
        v_coupon_id := c.id;
        v_message := 'Coupon applied.';
      end if;
    end if;
  end if;

  if v_coupon_id is null then v_coupon_discount := 0; end if;

  return eff || jsonb_build_object(
    'coupon_id', v_coupon_id,
    'coupon_code', case when v_coupon_id is not null then c.code end,
    'coupon_discount_minor', case when v_coupon_id is not null then v_regular - v_final - (case when v_final < v_promo_final then 0 else (eff->>'promotion_discount_minor')::int end) else 0 end,
    'coupon_message', v_message,
    'promotion_applied', v_coupon_id is null and (eff->>'promotion_active')::boolean,
    'payable_minor', v_final
  );
end;
$$;

revoke all on function public.evaluate_purchase_price(uuid, text) from public;
grant execute on function public.evaluate_purchase_price(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------- order creation
drop function if exists public.create_upi_order(uuid, integer);

create or replace function public.create_upi_order(
  _product_id uuid, _ttl_minutes integer default 15, _coupon_code text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.products; o public.orders; v_number text;
  q jsonb;
  v_price_id uuid; v_regular int; v_promo_disc int; v_coupon_disc int; v_total int;
  v_promo_id uuid; v_coupon_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _ttl_minutes is null or _ttl_minutes < 5 or _ttl_minutes > 60 then _ttl_minutes := 15; end if;

  select * into p from public.products where id = _product_id and is_active;
  if not found then raise exception 'Product not found'; end if;

  -- Server-side pricing. Any amount or discount supplied by the browser is ignored.
  q := public.evaluate_purchase_price(_product_id, _coupon_code);
  v_price_id := (q->>'price_id')::uuid;
  v_regular := (q->>'regular_minor')::int;
  v_total := (q->>'payable_minor')::int;
  v_coupon_id := nullif(q->>'coupon_id','')::uuid;
  v_promo_id := case when (q->>'promotion_applied')::boolean then nullif(q->>'promotion_id','')::uuid end;
  v_promo_disc := case when v_promo_id is not null then v_regular - v_total else 0 end;
  v_coupon_disc := case when v_coupon_id is not null then v_regular - v_total else 0 end;

  perform public.expire_stale_upi_orders();

  -- Reuse a live pending order only when it still matches today's server price.
  select o2.* into o
  from public.orders o2
  join public.order_items oi on oi.order_id = o2.id and oi.product_id = p.id
  join public.payment_attempts pa on pa.order_id = o2.id
  where o2.user_id = uid and o2.status = 'pending_payment'
    and pa.status in ('created','pending') and pa.expires_at > now()
    and o2.total_minor = v_total
    and o2.promotion_id is not distinct from v_promo_id
  order by o2.created_at desc limit 1;
  if found then return o; end if;

  v_number := 'AMEX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.orders (user_id, order_number, status, subtotal_minor, discount_minor,
                             total_minor, regular_subtotal_minor, promotion_discount_minor,
                             coupon_discount_minor, promotion_id, price_id, coupon_id,
                             placed_at, notes)
  values (uid, v_number, 'pending_payment', v_total, v_regular - v_total, v_total,
          v_regular, v_promo_disc, v_coupon_disc, v_promo_id, v_price_id, v_coupon_id,
          now(), 'UPI payment pending verification.')
  returning * into o;

  insert into public.order_items (order_id, product_id, price_id, product_name, unit_amount_minor, total_minor)
  values (o.id, p.id, v_price_id, p.name, v_regular, v_total);

  insert into public.payment_attempts (order_id, user_id, provider, method, status, amount_minor, expires_at, metadata)
  values (o.id, uid, 'razorpay', 'upi', 'created', v_total,
          now() + make_interval(mins => _ttl_minutes), '{}'::jsonb);

  perform public.log_financial_action('user', 'order.created', 'order', o.id, v_number,
    jsonb_build_object('provider', 'razorpay', 'method', 'upi',
                       'regular_minor', v_regular, 'promotion_id', v_promo_id,
                       'promotion_discount_minor', v_promo_disc,
                       'coupon_discount_minor', v_coupon_disc,
                       'amount_minor', v_total));

  return o;
end;
$$;

revoke all on function public.create_upi_order(uuid, integer, text) from public;
grant execute on function public.create_upi_order(uuid, integer, text) to authenticated, service_role;

-- ------------------------------------------ settlement with amount verification
drop function if exists public.settle_upi_payment(uuid, text, text, jsonb);

create or replace function public.settle_upi_payment(
  _order_id uuid, _provider_reference text, _method text, _payload jsonb default '{}'::jsonb,
  _amount_minor integer default null, _currency text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders; oi public.order_items; p public.products; pr public.prices;
  inv public.invoices; sub public.subscriptions; bp public.billing_profiles;
  v_expires timestamptz;
begin
  select * into o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 'paid' then
    return jsonb_build_object('status', 'already_paid', 'order_id', o.id);
  end if;
  if o.status not in ('pending_payment','failed','expired') then
    raise exception 'Order is not payable';
  end if;

  -- The provider must confirm exactly the amount and currency the server priced.
  if _amount_minor is not null and _amount_minor <> o.total_minor then
    perform public.log_financial_action('system', 'payment.amount_mismatch', 'order', o.id, o.order_number,
      jsonb_build_object('expected_minor', o.total_minor, 'received_minor', _amount_minor));
    raise exception 'Payment amount mismatch for order %', o.order_number;
  end if;
  if _currency is not null and upper(_currency) <> upper(o.currency) then
    perform public.log_financial_action('system', 'payment.currency_mismatch', 'order', o.id, o.order_number,
      jsonb_build_object('expected', o.currency, 'received', _currency));
    raise exception 'Payment currency mismatch for order %', o.order_number;
  end if;

  select * into oi from public.order_items where order_id = o.id limit 1;
  select * into p from public.products where id = oi.product_id;
  select * into pr from public.prices where id = oi.price_id;

  update public.payment_attempts
  set status = 'succeeded', provider_reference = _provider_reference, method = _method,
      metadata = metadata || jsonb_build_object('verified_at', now())
  where order_id = o.id and status in ('created','pending');

  insert into public.payment_attempts (order_id, user_id, provider, provider_reference, method,
                                       status, amount_minor, metadata)
  select o.id, o.user_id, 'razorpay', _provider_reference, _method, 'succeeded', o.total_minor,
         jsonb_build_object('verified_at', now())
  where not exists (select 1 from public.payment_attempts where order_id = o.id and status = 'succeeded');

  update public.orders set status = 'paid', paid_at = now(),
    notes = 'UPI payment verified server-side.' where id = o.id returning * into o;

  select * into bp from public.billing_profiles where user_id = o.user_id;

  insert into public.invoices (order_id, user_id, invoice_number, status,
                               subtotal_minor, discount_minor, total_minor, issued_at,
                               buyer_gstin, place_of_supply, seller_details, buyer_details)
  values (o.id, o.user_id, 'AMEX-INV-' || substr(o.order_number, 6), 'issued',
          o.regular_subtotal_minor, o.discount_minor, o.total_minor, now(),
          bp.gstin, coalesce(bp.place_of_supply, bp.state_name),
          jsonb_build_object('name', 'AskMeExam', 'country', 'IN',
                             'note', 'Seller registration details pending professional review.'),
          jsonb_build_object('legal_name', coalesce(bp.legal_name, ''),
                             'address_line1', coalesce(bp.address_line1, ''),
                             'city', coalesce(bp.city, ''),
                             'state_name', coalesce(bp.state_name, ''),
                             'postal_code', coalesce(bp.postal_code, '')))
  on conflict (order_id) do nothing
  returning * into inv;
  if inv.id is null then select * into inv from public.invoices where order_id = o.id; end if;

  v_expires := case when p.access_days is not null then now() + make_interval(days => p.access_days) end;

  if p.product_type = 'subscription' then
    insert into public.subscriptions (user_id, product_id, price_id, status,
                                      current_period_start, current_period_end, provider)
    values (o.user_id, p.id, pr.id, 'active', now(),
            now() + make_interval(months => case when pr.billing_interval = 'year'
                                                 then 12 * pr.interval_count else pr.interval_count end),
            'razorpay')
    returning * into sub;
    v_expires := sub.current_period_end;
  end if;

  insert into public.entitlements (user_id, product_id, source, order_id, subscription_id,
                                   access_scope, exam_id, certification_id, expires_at)
  select o.user_id, p.id, case when sub.id is not null then 'subscription' else 'order' end,
         o.id, sub.id, p.access_scope, p.exam_id, p.certification_id, v_expires
  where not exists (select 1 from public.entitlements where order_id = o.id);

  if o.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    select o.coupon_id, o.user_id, o.id
    where not exists (select 1 from public.coupon_redemptions where order_id = o.id);
    update public.coupons set redemption_count = redemption_count + 1 where id = o.coupon_id;
  end if;

  perform public.log_financial_action('system', 'order.paid', 'order', o.id, o.order_number,
    jsonb_build_object('provider', 'razorpay', 'method', _method,
                       'provider_reference', _provider_reference,
                       'regular_minor', o.regular_subtotal_minor,
                       'promotion_discount_minor', o.promotion_discount_minor,
                       'coupon_discount_minor', o.coupon_discount_minor,
                       'amount_minor', o.total_minor));
  perform public.log_financial_action('system', 'invoice.issued', 'invoice', inv.id, inv.invoice_number, '{}'::jsonb);

  perform public.enqueue_email_notification(
    o.user_id, 'purchase_confirmation', 'purchase-' || o.id::text,
    'Your AskMeExam purchase is confirmed',
    'Thank you. Order ' || o.order_number || ' is confirmed and your access is now active. ' ||
    'Invoice ' || coalesce(inv.invoice_number, '-') || ' is available on your purchases page. ' ||
    'AskMeExam practice materials and certificates are issued by AskMeExam and are not Microsoft credentials.',
    o.id);

  return jsonb_build_object('status', 'paid', 'order_id', o.id, 'exam_id', p.exam_id);
end;
$$;

revoke all on function public.settle_upi_payment(uuid, text, text, jsonb, integer, text) from public;
grant execute on function public.settle_upi_payment(uuid, text, text, jsonb, integer, text) to service_role;

-- ------------------------------------------------------------ admin reporting
create or replace function public.get_promotion_report(_promotion_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_role(auth.uid(), 'admin') then coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) end
  from (
    select pp.id as promotion_id, pp.name, pp.product_id, pr2.name as product_name,
           pp.promo_amount_minor, pp.starts_at, pp.ends_at, pp.time_zone, pp.is_active,
           pp.allow_coupon_stacking, pp.priority,
           coalesce(count(o.id) filter (where o.status = 'paid'), 0) as paid_orders,
           coalesce(count(o.id) filter (where o.status = 'pending_payment'), 0) as pending_orders,
           coalesce(count(o.id) filter (where o.status in ('expired','cancelled','failed')), 0) as expired_orders,
           coalesce(count(distinct o.user_id) filter (where o.status = 'paid'), 0) as students,
           coalesce(sum(o.regular_subtotal_minor) filter (where o.status = 'paid'), 0) as gross_minor,
           coalesce(sum(o.promotion_discount_minor) filter (where o.status = 'paid'), 0) as discount_minor,
           coalesce(sum(o.total_minor) filter (where o.status = 'paid'), 0) as collected_minor
    from public.price_promotions pp
    join public.products pr2 on pr2.id = pp.product_id
    left join public.orders o on o.promotion_id = pp.id
    where _promotion_id is null or pp.id = _promotion_id
    group by pp.id, pr2.name
    order by pp.starts_at desc
  ) t;
$$;

revoke all on function public.get_promotion_report(uuid) from public;
grant execute on function public.get_promotion_report(uuid) to authenticated, service_role;

-- Sales split by regular vs promotional pricing.
create or replace function public.get_pricing_sales_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_role(auth.uid(), 'admin') then jsonb_build_object(
    'regular_orders', count(*) filter (where status = 'paid' and promotion_id is null),
    'promotional_orders', count(*) filter (where status = 'paid' and promotion_id is not null),
    'gross_minor', coalesce(sum(regular_subtotal_minor) filter (where status = 'paid'), 0),
    'promotional_discount_minor', coalesce(sum(promotion_discount_minor) filter (where status = 'paid'), 0),
    'coupon_discount_minor', coalesce(sum(coupon_discount_minor) filter (where status = 'paid'), 0),
    'collected_minor', coalesce(sum(total_minor) filter (where status = 'paid'), 0),
    'pending_promotional_orders', count(*) filter (where status = 'pending_payment' and promotion_id is not null),
    'expired_promotional_orders', count(*) filter (where status in ('expired','cancelled','failed') and promotion_id is not null)
  ) end
  from public.orders;
$$;

revoke all on function public.get_pricing_sales_summary() from public;
grant execute on function public.get_pricing_sales_summary() to authenticated, service_role;

-- Keep entitlements pointed at the exam once an admin links the product to one.
create or replace function public.sync_entitlement_targets()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.exam_id is distinct from old.exam_id or new.certification_id is distinct from old.certification_id then
    update public.entitlements
    set exam_id = coalesce(exam_id, new.exam_id),
        certification_id = coalesce(certification_id, new.certification_id)
    where product_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_entitlements on public.products;
create trigger products_sync_entitlements after update on public.products
  for each row execute function public.sync_entitlement_targets();

-- ------------------------------------------------- launch offer configuration
insert into public.products (code, name, description, product_type, access_scope, access_days, sort_order, is_active)
values ('entra-id-mock-exam',
        'Microsoft Entra ID Realistic Mock Exam',
        'Full-length realistic practice exam for Microsoft Entra ID (SC-300 style), with domain-weighted question selection, scaled scoring and detailed review. AskMeExam is independent and is not affiliated with Microsoft.',
        'one_time_exam', 'exam', 180, 1, true)
on conflict (code) do update set is_active = true;

insert into public.prices (product_id, currency, amount_minor, is_active)
select id, 'INR', 50000, true from public.products where code = 'entra-id-mock-exam'
  and not exists (select 1 from public.prices where product_id = products.id and is_active);

insert into public.price_promotions (product_id, name, description, promo_amount_minor,
                                     starts_at, ends_at, time_zone, is_active, allow_coupon_stacking, priority)
select id, 'Limited-Time Launch Offer',
       'Launch pricing for the Microsoft Entra ID Realistic Mock Exam.',
       30000, now(), timestamptz '2026-09-02 23:59:59.999+05:30',
       'Asia/Kolkata', true, false, 0
from public.products where code = 'entra-id-mock-exam'
on conflict do nothing;