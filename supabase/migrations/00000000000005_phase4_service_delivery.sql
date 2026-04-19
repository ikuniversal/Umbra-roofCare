-- Phase 4: Service Delivery
--
-- Adds opportunity pipeline stages, quote builder tables, job operational
-- fields, crew scheduling primitives, and helper RPCs.
--
-- Reconciliation notes:
--  * opportunities, jobs, crews, and crew_assignments already exist from
--    Phase 1 as placeholders — we ALTER those tables rather than recreate.
--  * crew_members is a new table (distinct from the Phase 1 crew_assignments)
--    so we can record membership history (joined_at / left_at).
--  * jobs.status had a Phase 1 check constraint (quoted/accepted/scheduled
--    /in_progress/completed/cancelled/on_hold). We drop that constraint and
--    replace it with the Phase 4 set. jobs is empty at migration time.

-- ---------------------------------------------------------------
-- OPPORTUNITIES
-- ---------------------------------------------------------------
alter table opportunities
  add column if not exists stage text not null default 'prospecting',
  add column if not exists stage_order int not null default 0,
  add column if not exists assigned_to uuid references profiles(id),
  add column if not exists expected_close_date date,
  add column if not exists value_estimate numeric(12,2),
  add column if not exists updated_at timestamptz default now();

-- Enforce stage values. Drop first in case we re-run with a different set.
alter table opportunities drop constraint if exists opportunities_stage_check;
alter table opportunities
  add constraint opportunities_stage_check
  check (stage in ('prospecting','quoted','scheduled','in_progress','completed','lost'));

-- Backfill: opportunities created before Phase 4 come in with stage='prospecting'
-- by default, but legacy status values can guide us:
update opportunities
set stage = case
  when status = 'won' then 'completed'
  when status = 'lost' then 'lost'
  when status = 'quoted' then 'quoted'
  else 'prospecting'
end
where stage = 'prospecting' and status is not null;

-- And value_estimate from existing cents column.
update opportunities
set value_estimate = round(estimated_value_cents::numeric / 100, 2)
where value_estimate is null and estimated_value_cents is not null;

create index if not exists idx_opportunities_stage on opportunities(stage, stage_order);
create index if not exists idx_opportunities_assigned on opportunities(assigned_to);

-- Keep updated_at fresh when stage or assignment changes.
create or replace function public.touch_opportunity_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_opportunities_touch on opportunities;
create trigger trg_opportunities_touch
  before update on opportunities
  for each row execute function public.touch_opportunity_updated_at();

-- ---------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid not null references organizations(id),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  quote_number text not null,
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','rejected','expired')),
  prepared_by uuid references profiles(id),
  valid_until date,
  subtotal_materials numeric(12,2) default 0,
  subtotal_labor numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  tax_rate numeric(5,4) default 0.0825,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  terms text,
  accepted_at timestamptz,
  accepted_by_member boolean default false,
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists quotes_number_unique on quotes(opco_id, quote_number);
create index if not exists idx_quotes_opportunity on quotes(opportunity_id);
create index if not exists idx_quotes_opco_status on quotes(opco_id, status);

-- Touch updated_at on every update.
create or replace function public.touch_quote_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_quotes_touch on quotes;
create trigger trg_quotes_touch
  before update on quotes
  for each row execute function public.touch_quote_updated_at();

-- ---------------------------------------------------------------
-- QUOTE LINE ITEMS
-- ---------------------------------------------------------------
create table if not exists quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  kind text not null check (kind in ('material','labor','fee','discount')),
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit text,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  sort_order int default 0
);

create index if not exists idx_quote_line_items_quote on quote_line_items(quote_id);

-- ---------------------------------------------------------------
-- JOBS (extend Phase 1 placeholder)
-- ---------------------------------------------------------------
alter table jobs
  add column if not exists quote_id uuid references quotes(id),
  add column if not exists job_type text,
  add column if not exists priority text default 'normal',
  add column if not exists scope_summary text,
  add column if not exists completion_notes text,
  add column if not exists completion_photo_urls text[],
  add column if not exists member_signature_url text,
  add column if not exists updated_at timestamptz default now();

alter table jobs drop constraint if exists jobs_status_check;
alter table jobs
  add constraint jobs_status_check
  check (status in ('ready_to_schedule','scheduled','in_progress','on_hold','completed','cancelled'));

alter table jobs drop constraint if exists jobs_job_type_check;
alter table jobs
  add constraint jobs_job_type_check
  check (job_type in ('repair','replacement','rejuvenation','maintenance','inspection_followup')
         or job_type is null);

alter table jobs drop constraint if exists jobs_priority_check;
alter table jobs
  add constraint jobs_priority_check
  check (priority in ('urgent','high','normal','low'));

-- Any pre-existing jobs (none currently) with a disallowed status get mapped.
update jobs set status = 'ready_to_schedule' where status in ('quoted','accepted');

create index if not exists idx_jobs_status_scheduled on jobs(status, scheduled_start);
create index if not exists idx_jobs_scheduled_start on jobs(scheduled_start);

create or replace function public.touch_job_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_jobs_touch on jobs;
create trigger trg_jobs_touch
  before update on jobs
  for each row execute function public.touch_job_updated_at();

-- ---------------------------------------------------------------
-- CREWS (extend Phase 1 placeholder)
-- ---------------------------------------------------------------
alter table crews
  add column if not exists crew_code text,
  add column if not exists specialties text[] default '{}',
  add column if not exists max_concurrent_jobs int default 1,
  add column if not exists home_base text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz default now();

-- Backfill crew_code for any existing rows (none expected).
update crews
set crew_code = upper(regexp_replace(coalesce(name, 'CREW'), '[^A-Za-z0-9]', '', 'g'))
where crew_code is null;

-- Now enforce presence + uniqueness per OpCo.
alter table crews alter column crew_code set not null;
create unique index if not exists crews_code_unique on crews(opco_id, crew_code);

-- The Phase 1 crews.type check limits to 4 values — relax it so OpCos that
-- run mixed-discipline crews don't hit constraint errors.
alter table crews drop constraint if exists crews_type_check;
alter table crews
  add constraint crews_type_check
  check (type in ('inspection','maintenance','repair','replacement','mixed') or type is null);

-- Now that crews is populated with crew_code, add FK from jobs.crew_id.
alter table jobs drop constraint if exists jobs_crew_fk;
alter table jobs add constraint jobs_crew_fk foreign key (crew_id) references crews(id);

-- ---------------------------------------------------------------
-- CREW MEMBERS (new — supersedes Phase 1 crew_assignments for Phase 4 UX)
-- ---------------------------------------------------------------
create table if not exists crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crews(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text check (role in ('lead','tech','helper')) default 'tech',
  joined_at date default current_date,
  left_at date,
  unique(crew_id, profile_id)
);

create index if not exists idx_crew_members_crew on crew_members(crew_id);
create index if not exists idx_crew_members_profile on crew_members(profile_id);

-- ---------------------------------------------------------------
-- CREW AVAILABILITY
-- ---------------------------------------------------------------
create table if not exists crew_availability (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crews(id) on delete cascade,
  kind text not null check (kind in ('working_hours','time_off','holiday')),
  weekday int check (weekday between 0 and 6),
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  notes text
);

create index if not exists idx_crew_availability_crew on crew_availability(crew_id);

-- ---------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------

-- Sequential quote number per OpCo: "{OPCO-CODE}-{YYYY}-{0001}"
create or replace function public.generate_quote_number(p_opco_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_code text;
  v_year text;
  v_count int;
begin
  select slug into v_slug from organizations where id = p_opco_id;
  if v_slug is null then
    raise exception 'Unknown opco %', p_opco_id;
  end if;

  -- Uppercase, strip non-alphanumerics, take last token after a hyphen if present.
  v_code := upper(split_part(v_slug, '-', -1));
  if length(v_code) < 2 then
    v_code := upper(regexp_replace(v_slug, '[^A-Za-z0-9]', '', 'g'));
  end if;

  v_year := to_char(now(), 'YYYY');

  select count(*) + 1 into v_count
  from quotes
  where opco_id = p_opco_id
    and quote_number like v_code || '-' || v_year || '-%';

  return v_code || '-' || v_year || '-' || lpad(v_count::text, 4, '0');
end;
$$;

grant execute on function public.generate_quote_number(uuid) to authenticated;

-- Recompute totals from line items.
create or replace function public.recalculate_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_materials numeric(12,2);
  v_labor numeric(12,2);
  v_fees numeric(12,2);
  v_discounts numeric(12,2);
  v_discount_override numeric(12,2);
  v_tax_rate numeric(5,4);
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
begin
  select
    coalesce(sum(line_total) filter (where kind = 'material'), 0),
    coalesce(sum(line_total) filter (where kind = 'labor'), 0),
    coalesce(sum(line_total) filter (where kind = 'fee'), 0),
    coalesce(sum(line_total) filter (where kind = 'discount'), 0)
  into v_materials, v_labor, v_fees, v_discounts
  from quote_line_items
  where quote_id = p_quote_id;

  select tax_rate, discount_amount
  into v_tax_rate, v_discount_override
  from quotes
  where id = p_quote_id;

  -- discounts on line items are stored as positive numbers; we subtract here.
  v_subtotal := v_materials + v_labor + v_fees - v_discounts - coalesce(v_discount_override, 0);
  if v_subtotal < 0 then v_subtotal := 0; end if;

  v_tax := round(v_subtotal * coalesce(v_tax_rate, 0), 2);
  v_total := v_subtotal + v_tax;

  update quotes
  set subtotal_materials = v_materials,
      subtotal_labor = v_labor,
      tax_amount = v_tax,
      total = v_total
  where id = p_quote_id;
end;
$$;

grant execute on function public.recalculate_quote_totals(uuid) to authenticated;

-- Compute line_total and refresh quote totals on every line-item change.
create or replace function public.quote_line_items_recompute()
returns trigger
language plpgsql
as $$
declare
  v_quote_id uuid;
begin
  if tg_op = 'DELETE' then
    v_quote_id := old.quote_id;
  else
    -- Normalize line_total to quantity * unit_price before persisting.
    new.line_total := round(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0), 2);
    v_quote_id := new.quote_id;
  end if;
  perform public.recalculate_quote_totals(v_quote_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quote_line_items_recompute on quote_line_items;
create trigger trg_quote_line_items_recompute
  before insert or update on quote_line_items
  for each row execute function public.quote_line_items_recompute();

drop trigger if exists trg_quote_line_items_recompute_after on quote_line_items;
create trigger trg_quote_line_items_recompute_after
  after delete on quote_line_items
  for each row execute function public.quote_line_items_recompute();

-- Accept a quote: mark accepted, create the job, advance the opportunity.
create or replace function public.accept_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_opp opportunities%rowtype;
  v_job_id uuid;
  v_job_number text;
begin
  select * into v_quote from quotes where id = p_quote_id;
  if not found then raise exception 'Quote not found'; end if;

  if not (
    is_super_admin()
    or v_quote.opco_id = current_opco_id()
  ) then
    raise exception 'Not authorized for this OpCo';
  end if;

  select * into v_opp from opportunities where id = v_quote.opportunity_id;

  update quotes
  set status = 'accepted',
      accepted_at = now(),
      accepted_by_member = true
  where id = p_quote_id;

  v_job_number := v_quote.quote_number || '-J';

  insert into jobs (
    opco_id,
    member_id,
    property_id,
    opportunity_id,
    quote_id,
    job_type,
    status,
    priority,
    quoted_cents,
    scope_summary,
    job_number,
    created_at
  )
  values (
    v_quote.opco_id,
    v_opp.member_id,
    (select property_id from inspections where id = v_opp.inspection_id limit 1),
    v_opp.id,
    v_quote.id,
    case v_opp.type
      when 'repair' then 'repair'
      when 'replacement_plan' then 'replacement'
      when 'rejuvenation' then 'rejuvenation'
      else 'repair'
    end,
    'ready_to_schedule',
    coalesce(v_opp.priority, 'normal'),
    round(v_quote.total * 100)::int,
    v_quote.notes,
    v_job_number,
    now()
  )
  returning id into v_job_id;

  update opportunities
  set stage = 'scheduled',
      status = 'won',
      closed_at = now(),
      won_job_id = v_job_id
  where id = v_opp.id;

  insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
  values
    (v_quote.opco_id, auth.uid(), 'quote', v_quote.id, 'quote.accepted',
     jsonb_build_object('total', v_quote.total)),
    (v_quote.opco_id, auth.uid(), 'job', v_job_id, 'job.created_from_quote',
     jsonb_build_object('quote_id', v_quote.id, 'opportunity_id', v_opp.id));

  return v_job_id;
end;
$$;

grant execute on function public.accept_quote(uuid) to authenticated;

-- ---------------------------------------------------------------
-- ENABLE RLS + tenant policies for new tables
-- ---------------------------------------------------------------
alter table quotes enable row level security;
alter table quote_line_items enable row level security;
alter table crew_members enable row level security;
alter table crew_availability enable row level security;

drop policy if exists "quotes_tenant" on quotes;
create policy "quotes_tenant" on quotes for all
  using (opco_id = current_opco_id() or is_super_admin())
  with check (opco_id = current_opco_id() or is_super_admin());

drop policy if exists "quote_line_items_tenant" on quote_line_items;
create policy "quote_line_items_tenant" on quote_line_items for all
  using (exists (
    select 1 from quotes q where q.id = quote_line_items.quote_id
      and (q.opco_id = current_opco_id() or is_super_admin())
  ))
  with check (exists (
    select 1 from quotes q where q.id = quote_line_items.quote_id
      and (q.opco_id = current_opco_id() or is_super_admin())
  ));

drop policy if exists "crew_members_tenant" on crew_members;
create policy "crew_members_tenant" on crew_members for all
  using (exists (
    select 1 from crews c where c.id = crew_members.crew_id
      and (c.opco_id = current_opco_id() or is_super_admin())
  ))
  with check (exists (
    select 1 from crews c where c.id = crew_members.crew_id
      and (c.opco_id = current_opco_id() or is_super_admin())
  ));

drop policy if exists "crew_availability_tenant" on crew_availability;
create policy "crew_availability_tenant" on crew_availability for all
  using (exists (
    select 1 from crews c where c.id = crew_availability.crew_id
      and (c.opco_id = current_opco_id() or is_super_admin())
  ))
  with check (exists (
    select 1 from crews c where c.id = crew_availability.crew_id
      and (c.opco_id = current_opco_id() or is_super_admin())
  ));

-- ---------------------------------------------------------------
-- Decision Engine integration — opportunities start at prospecting
-- ---------------------------------------------------------------
-- The Phase 3 RPC inserts with stage null default. With the new default
-- 'prospecting' + trigger, no changes needed — but we update the RPC to
-- set stage explicitly for safety.
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
    stage,
    priority,
    notes,
    opened_at
  ) values (
    v_row.opco_id,
    v_row.member_id,
    v_row.id,
    p_type,
    'open',
    'prospecting',
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
