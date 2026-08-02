
create or replace function public.get_exam_access_map()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'exam_id', x.id,
    'requires_purchase', public.exam_requires_purchase(x.id),
    'has_access', public.has_exam_access(auth.uid(), x.id) or public.has_org_exam_access(auth.uid(), x.id),
    'product_id', (
      select p.id from public.products p
      join public.prices pr on pr.product_id = p.id and pr.is_active
      where p.is_active and (
        (p.access_scope = 'exam' and p.exam_id = x.id)
        or (p.access_scope = 'certification' and p.certification_id = x.certification_id))
      order by (p.access_scope = 'exam') desc, p.sort_order limit 1
    )
  )), '[]'::jsonb)
  from public.exams x
  where x.is_published;
$$;
revoke all on function public.get_exam_access_map() from public, anon;
grant execute on function public.get_exam_access_map() to authenticated;
