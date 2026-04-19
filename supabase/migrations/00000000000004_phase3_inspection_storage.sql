-- Phase 3: Inspection Engine storage, templates, rules.
--
-- Adds:
--   * inspection_templates  — versioned 20-point scoring checklists per OpCo (null = default)
--   * decision_engine_rules — ordered conditions/actions evaluated when an inspection completes
--   * inspections.checkpoint_results (jsonb) — per-checkpoint rating/notes/photos
--   * inspections.template_id — which template the inspection was captured against
--   * Storage buckets for photos and generated PDFs, with RLS scoped to opco
--     membership via the profile helper.

create table if not exists inspection_templates (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id) on delete cascade,
  name text not null,
  version int not null default 1,
  active boolean default true,
  checkpoints jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inspection_templates_opco
  on inspection_templates(opco_id);

create table if not exists decision_engine_rules (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  priority int not null,
  active boolean default true,
  conditions jsonb not null,
  actions jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_decision_rules_opco_priority
  on decision_engine_rules(opco_id, priority);

-- Inspection detail columns that weren't part of the initial schema.
alter table inspections
  add column if not exists checkpoint_results jsonb,
  add column if not exists template_id uuid references inspection_templates(id),
  add column if not exists template_version int;

-- Enable RLS and apply the standard tenant pattern.
alter table inspection_templates enable row level security;
alter table decision_engine_rules enable row level security;

drop policy if exists "inspection_templates_tenant" on inspection_templates;
create policy "inspection_templates_tenant"
  on inspection_templates for all
  using (
    opco_id is null
    or opco_id = current_opco_id()
    or is_super_admin()
  )
  with check (
    opco_id = current_opco_id()
    or is_super_admin()
  );

drop policy if exists "decision_engine_rules_tenant" on decision_engine_rules;
create policy "decision_engine_rules_tenant"
  on decision_engine_rules for all
  using (
    opco_id is null
    or opco_id = current_opco_id()
    or is_super_admin()
  )
  with check (
    opco_id = current_opco_id()
    or is_super_admin()
  );

-- Storage buckets for inspection photos and rendered PDFs. Private only —
-- clients use signed URLs rendered via the app or the edge function.
insert into storage.buckets (id, name, public)
values
  ('inspection-photos', 'inspection-photos', false),
  ('inspection-reports', 'inspection-reports', false)
on conflict (id) do nothing;

-- Photo / PDF paths follow the convention: {opco_id}/{inspection_id}/{name}.ext
-- The leading UUID segment lets us scope read/write access to opco members
-- without having to decode metadata on every row.

drop policy if exists "inspection_photos_read" on storage.objects;
create policy "inspection_photos_read" on storage.objects
  for select
  using (
    bucket_id = 'inspection-photos'
    and (
      is_super_admin()
      or (
        split_part(name, '/', 1)::uuid = current_opco_id()
      )
    )
  );

drop policy if exists "inspection_photos_insert" on storage.objects;
create policy "inspection_photos_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'inspection-photos'
    and (
      is_super_admin()
      or (
        split_part(name, '/', 1)::uuid = current_opco_id()
      )
    )
  );

drop policy if exists "inspection_photos_update" on storage.objects;
create policy "inspection_photos_update" on storage.objects
  for update
  using (
    bucket_id = 'inspection-photos'
    and (
      is_super_admin()
      or split_part(name, '/', 1)::uuid = current_opco_id()
    )
  );

drop policy if exists "inspection_photos_delete" on storage.objects;
create policy "inspection_photos_delete" on storage.objects
  for delete
  using (
    bucket_id = 'inspection-photos'
    and (
      is_super_admin()
      or split_part(name, '/', 1)::uuid = current_opco_id()
    )
  );

drop policy if exists "inspection_reports_read" on storage.objects;
create policy "inspection_reports_read" on storage.objects
  for select
  using (
    bucket_id = 'inspection-reports'
    and (
      is_super_admin()
      or split_part(name, '/', 1)::uuid = current_opco_id()
    )
  );

-- Edge function writes PDFs with the service role, which bypasses RLS,
-- but we also want OpCo GMs / super admins to be able to re-upload a
-- replacement report from the app.
drop policy if exists "inspection_reports_insert" on storage.objects;
create policy "inspection_reports_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'inspection-reports'
    and (
      is_super_admin()
      or split_part(name, '/', 1)::uuid = current_opco_id()
    )
  );

-- Decision Engine RPC. We want opportunities created on behalf of the
-- inspector without giving the inspector direct insert rights on
-- opportunities (RLS denies it if they aren't in OPCO_MANAGERS). This
-- SECURITY DEFINER function inserts on their behalf after verifying the
-- inspection belongs to their OpCo.
create or replace function public.create_inspection_opportunity(
  p_inspection_id uuid,
  p_type text,
  p_priority text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row inspections%rowtype;
  v_new_id uuid;
begin
  select * into v_row from inspections where id = p_inspection_id;
  if not found then
    raise exception 'Inspection % not found', p_inspection_id;
  end if;

  if not (
    is_super_admin()
    or v_row.opco_id = current_opco_id()
  ) then
    raise exception 'Not authorized for this OpCo';
  end if;

  insert into opportunities (
    opco_id,
    member_id,
    inspection_id,
    type,
    status,
    priority,
    notes,
    opened_at
  ) values (
    v_row.opco_id,
    v_row.member_id,
    v_row.id,
    p_type,
    'open',
    p_priority,
    p_notes,
    now()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_inspection_opportunity(uuid, text, text, text)
  to authenticated;
