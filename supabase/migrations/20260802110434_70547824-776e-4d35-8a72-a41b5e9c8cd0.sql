-- document_folders
create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  parent_id uuid references public.document_folders(id) on delete set null,
  archived boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.document_folders to authenticated;
grant all on public.document_folders to service_role;

alter table public.document_folders enable row level security;

drop trigger if exists set_updated_at on public.document_folders;
create trigger set_updated_at before update on public.document_folders
  for each row execute function public.set_updated_at();

create policy "Admins manage all folders" on public.document_folders
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Authenticated view non-archived folders" on public.document_folders
  for select
  using (archived = false);

-- enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_category') then
    create type public.document_category as enum (
      'study_notes', 'course_material', 'revision_guide', 'practice_material',
      'reference', 'policy', 'trainer_internal'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'document_visibility') then
    create type public.document_visibility as enum (
      'admin_only', 'trainer', 'students', 'exam_assigned'
    );
  end if;
end $$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.document_folders(id) on delete set null,
  title text not null,
  description text,
  category public.document_category not null default 'reference',
  visibility public.document_visibility not null default 'admin_only',
  tags text[] not null default '{}',
  certification_id uuid references public.certifications(id) on delete set null,
  domain_id uuid references public.domains(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  exam_id uuid references public.exams(id) on delete set null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_extension text not null,
  size_bytes bigint not null,
  archived boolean not null default false,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_visibility_idx on public.documents(visibility);
create index if not exists documents_archived_idx on public.documents(archived);
create index if not exists documents_folder_id_idx on public.documents(folder_id);
create index if not exists documents_certification_id_idx on public.documents(certification_id);

grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;

alter table public.documents enable row level security;

drop trigger if exists set_updated_at on public.documents;
create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create policy "Admins manage all documents" on public.documents
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Students view assigned documents" on public.documents
  for select
  using (
    archived = false
    and (
      visibility = 'students'
      or (
        visibility = 'exam_assigned'
        and (
          exam_id is null
          or exists (
            select 1 from public.attempts a
            where a.exam_id = public.documents.exam_id
              and a.user_id = auth.uid()
          )
        )
      )
    )
  );

-- storage policies for documents bucket
drop policy if exists "Admins manage document objects" on storage.objects;
create policy "Admins manage document objects" on storage.objects
  for all
  using (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Students read assigned document objects" on storage.objects;
create policy "Students read assigned document objects" on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and d.archived = false
        and (
          d.visibility = 'students'
          or (
            d.visibility = 'exam_assigned'
            and (
              d.exam_id is null
              or exists (
                select 1 from public.attempts a
                where a.exam_id = d.exam_id
                  and a.user_id = auth.uid()
              )
            )
          )
        )
    )
  );
