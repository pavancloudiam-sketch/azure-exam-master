create or replace function public.get_public_certifications()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  provider text,
  exam_code text,
  version text,
  effective_at date,
  retired_at date,
  lifecycle_status text,
  allow_new_attempts boolean,
  exam_count integer,
  topic_count integer,
  domains jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.code,
    c.name,
    c.description,
    c.provider,
    c.exam_code,
    c.version,
    c.effective_at,
    c.retired_at,
    c.lifecycle_status,
    c.allow_new_attempts,
    (select count(*)::int from exams e
      where e.certification_id = c.id and e.is_published and e.is_active) as exam_count,
    (select count(*)::int from topics t
       join domains d2 on d2.id = t.domain_id
      where d2.certification_id = c.id and d2.is_active and t.is_active) as topic_count,
    coalesce((
      select jsonb_agg(x order by x->>'sort_order', x->>'name')
      from (
        select jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'weight_percent', d.weight_percent,
          'sort_order', d.sort_order,
          'topic_count', (select count(*)::int from topics t where t.domain_id = d.id and t.is_active)
        ) as x
        from domains d
        where d.certification_id = c.id and d.is_active
      ) s
    ), '[]'::jsonb) as domains
  from certifications c
  where c.is_active
  order by c.provider, c.name, c.version;
$$;

revoke all on function public.get_public_certifications() from public;
grant execute on function public.get_public_certifications() to anon, authenticated, service_role;