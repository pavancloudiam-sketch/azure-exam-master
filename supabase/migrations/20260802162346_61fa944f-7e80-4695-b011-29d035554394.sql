
-- 1. Order status gains "expired"
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check (status = any (array['draft','pending_payment','paid','failed','cancelled','expired','refunded','partially_refunded']));

-- 2. Payment attempt expiry window
alter table public.payment_attempts add column if not exists expires_at timestamptz;

-- 3. Inbound provider events (dedupe + audit)
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','processed','ignored','error')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

grant select on public.payment_webhook_events to authenticated;
grant all on public.payment_webhook_events to service_role;
alter table public.payment_webhook_events enable row level security;
create policy "Admins read payment webhook events"
  on public.payment_webhook_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- 4. Does an exam sit behind a paid product?
create or replace function public.exam_requires_purchase(_exam_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.products p
    join public.prices pr on pr.product_id = p.id and pr.is_active and pr.amount_minor > 0
    left join public.exams x on x.id = _exam_id
    where p.is_active
      and (
        (p.access_scope = 'exam' and p.exam_id = _exam_id)
        or (p.access_scope = 'certification' and p.certification_id = x.certification_id)
      )
  )
$$;

-- 5. Student creates (or reuses) a pending UPI order
create or replace function public.create_upi_order(_product_id uuid, _ttl_minutes integer default 15)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.products; pr public.prices; o public.orders; v_number text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _ttl_minutes is null or _ttl_minutes < 5 or _ttl_minutes > 60 then _ttl_minutes := 15; end if;

  select * into p from public.products where id = _product_id and is_active;
  if not found then raise exception 'Product not found'; end if;
  select * into pr from public.prices where product_id = p.id and is_active order by created_at limit 1;
  if not found then raise exception 'Product has no active price'; end if;

  perform public.expire_stale_upi_orders();

  -- Reuse an unexpired pending order for the same product instead of piling up rows.
  select o2.* into o
  from public.orders o2
  join public.order_items oi on oi.order_id = o2.id and oi.product_id = p.id
  join public.payment_attempts pa on pa.order_id = o2.id
  where o2.user_id = uid and o2.status = 'pending_payment'
    and pa.status in ('created','pending') and pa.expires_at > now()
  order by o2.created_at desc limit 1;
  if found then return o; end if;

  v_number := 'AMEX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.orders (user_id, order_number, status, subtotal_minor, total_minor, placed_at, notes)
  values (uid, v_number, 'pending_payment', pr.amount_minor, pr.amount_minor, now(), 'UPI payment pending verification.')
  returning * into o;

  insert into public.order_items (order_id, product_id, price_id, product_name, unit_amount_minor, total_minor)
  values (o.id, p.id, pr.id, p.name, pr.amount_minor, pr.amount_minor);

  insert into public.payment_attempts (order_id, user_id, provider, method, status, amount_minor, expires_at, metadata)
  values (o.id, uid, 'razorpay', 'upi', 'created', pr.amount_minor,
          now() + make_interval(mins => _ttl_minutes), '{}'::jsonb);

  perform public.log_financial_action('student', 'order.created', 'order', o.id, v_number,
    jsonb_build_object('provider', 'razorpay', 'method', 'upi', 'amount_minor', pr.amount_minor));

  return o;
end;
$$;

-- 6. Expire abandoned payment windows
create or replace function public.expire_stale_upi_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  with stale as (
    update public.payment_attempts pa set status = 'cancelled',
      failure_code = coalesce(pa.failure_code, 'expired'),
      failure_message = coalesce(pa.failure_message, 'Payment window expired before confirmation.')
    where pa.status in ('created','pending') and pa.expires_at is not null and pa.expires_at <= now()
    returning pa.order_id
  ), upd as (
    update public.orders o set status = 'expired', cancelled_at = now()
    where o.id in (select order_id from stale) and o.status = 'pending_payment'
    returning o.id
  )
  select count(*) into v_count from upd;
  return v_count;
end;
$$;

-- 7. Student cancels their own pending payment
create or replace function public.cancel_upi_order(_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.orders;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into o from public.orders where id = _order_id and user_id = uid;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'pending_payment' then return; end if;

  update public.payment_attempts set status = 'cancelled',
    failure_code = coalesce(failure_code, 'cancelled_by_user')
  where order_id = o.id and status in ('created','pending');
  update public.orders set status = 'cancelled', cancelled_at = now() where id = o.id;
  perform public.log_financial_action('student', 'order.cancelled', 'order', o.id, o.order_number, '{}'::jsonb);
end;
$$;

-- 8. Payment status for the payment screen (owner only)
create or replace function public.get_upi_payment_status(_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.orders; pa public.payment_attempts; v_exam uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into o from public.orders where id = _order_id and user_id = uid;
  if not found then raise exception 'Order not found'; end if;
  select * into pa from public.payment_attempts where order_id = o.id order by created_at desc limit 1;
  select e.exam_id into v_exam from public.entitlements e where e.order_id = o.id limit 1;

  return jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'order_status', case when o.status = 'pending_payment' and pa.expires_at <= now() then 'expired' else o.status end,
    'payment_status', pa.status,
    'total_minor', o.total_minor,
    'tax_minor', o.tax_minor,
    'subtotal_minor', o.subtotal_minor,
    'expires_at', pa.expires_at,
    'paid_at', o.paid_at,
    'exam_id', v_exam
  );
end;
$$;

-- 9. Server-verified settlement (service role only)
create or replace function public.settle_upi_payment(
  _order_id uuid, _provider_reference text, _method text default 'upi', _payload jsonb default '{}'::jsonb)
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
                               subtotal_minor, total_minor, issued_at, buyer_gstin, place_of_supply,
                               seller_details, buyer_details)
  values (o.id, o.user_id, 'AMEX-INV-' || substr(o.order_number, 6), 'issued',
          o.subtotal_minor, o.total_minor, now(), bp.gstin, coalesce(bp.place_of_supply, bp.state_name),
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

  perform public.log_financial_action('system', 'order.paid', 'order', o.id, o.order_number,
    jsonb_build_object('provider', 'razorpay', 'method', _method,
                       'provider_reference', _provider_reference, 'amount_minor', o.total_minor));
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

-- 10. Server-verified failure (service role only)
create or replace function public.fail_upi_payment(
  _order_id uuid, _provider_reference text, _code text default 'payment_failed', _message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'pending_payment' then
    return jsonb_build_object('status', o.status, 'order_id', o.id);
  end if;

  update public.payment_attempts
  set status = 'failed', provider_reference = coalesce(_provider_reference, provider_reference),
      failure_code = _code, failure_message = _message
  where order_id = o.id and status in ('created','pending');

  update public.orders set status = 'failed' where id = o.id;

  perform public.log_financial_action('system', 'order.payment_failed', 'order', o.id, o.order_number,
    jsonb_build_object('code', _code));
  perform public.enqueue_email_notification(
    o.user_id, 'payment_failure', 'payment-failed-' || o.id::text,
    'We could not process your payment',
    'Your payment for order ' || o.order_number || ' did not go through, so no access was granted. ' ||
    'You can try again from your purchases page.', o.id);

  return jsonb_build_object('status', 'failed', 'order_id', o.id);
end;
$$;

-- 11. Store provider references on the pending attempt (service role only)
create or replace function public.attach_upi_payment_reference(
  _order_id uuid, _reference text, _metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  update public.payment_attempts
  set provider_reference = _reference, status = 'pending', metadata = metadata || _metadata
  where order_id = _order_id and status in ('created','pending');
$$;

-- 12. Idempotent webhook recording (service role only)
create or replace function public.record_payment_webhook(
  _event_id text, _event_type text, _order_id uuid, _payload jsonb, _provider text default 'razorpay')
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.payment_webhook_events (provider, event_id, event_type, order_id, payload)
  values (_provider, _event_id, _event_type, _order_id, _payload)
  on conflict (provider, event_id) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.complete_payment_webhook(
  _event_id text, _status text, _error text default null, _provider text default 'razorpay')
returns void language sql security definer set search_path = public as $$
  update public.payment_webhook_events
  set status = _status, error = _error, processed_at = now()
  where provider = _provider and event_id = _event_id;
$$;

-- 13. Lock down the server-only routines
revoke all on function public.settle_upi_payment(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_upi_payment(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.attach_upi_payment_reference(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_payment_webhook(text, text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.complete_payment_webhook(text, text, text, text) from public, anon, authenticated;
revoke all on function public.expire_stale_upi_orders() from public, anon;
grant execute on function public.settle_upi_payment(uuid, text, text, jsonb) to service_role;
grant execute on function public.fail_upi_payment(uuid, text, text, text) to service_role;
grant execute on function public.attach_upi_payment_reference(uuid, text, jsonb) to service_role;
grant execute on function public.record_payment_webhook(text, text, uuid, jsonb, text) to service_role;
grant execute on function public.complete_payment_webhook(text, text, text, text) to service_role;
grant execute on function public.create_upi_order(uuid, integer) to authenticated;
grant execute on function public.cancel_upi_order(uuid) to authenticated;
grant execute on function public.get_upi_payment_status(uuid) to authenticated;
grant execute on function public.exam_requires_purchase(uuid) to anon, authenticated, service_role;
