-- Phase 5: Monetization
--
-- Introduces subscription_plans, rebuilds subscriptions + commissions per
-- the Phase 5 spec (Phase 1 shipped placeholder tables — both empty — so
-- we drop and recreate to land the right columns and constraints without
-- touching production data). Adds invoices, subscription_events, and
-- opco_stripe_accounts. Wires up RLS, helper SQL functions, and a
-- completion trigger for specialist job commissions.

-- ---------------------------------------------------------------
-- 0. Drop Phase 1 placeholder tables (empty by design).
-- ---------------------------------------------------------------
-- Guarded: if a future rebase has populated them, this will fail loudly
-- and force a conversation. For the live pilot these tables have no rows.
do $$
begin
  if exists (select 1 from public.subscriptions) then
    raise exception 'Phase 5 migration: subscriptions has rows; aborting drop. Reconcile manually.';
  end if;
exception
  when undefined_table then null;
end$$;

do $$
begin
  if exists (select 1 from public.commissions) then
    raise exception 'Phase 5 migration: commissions has rows; aborting drop. Reconcile manually.';
  end if;
exception
  when undefined_table then null;
end$$;

drop table if exists commissions cascade;
drop table if exists subscriptions cascade;

-- ---------------------------------------------------------------
-- 1. subscription_plans — the 4 Umbra tiers.
-- ---------------------------------------------------------------
create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tier_level int not null,
  annual_price_cents int not null,
  monthly_price_cents int not null,
  quarterly_price_cents int not null,
  stripe_product_id text,
  stripe_price_annual_id text,
  stripe_price_monthly_id text,
  stripe_price_quarterly_id text,
  features jsonb default '[]'::jsonb,
  cra_enrollment_commission_cents int not null,
  cra_renewal_residual_pct numeric(5,4) not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------
-- 2. subscriptions — member-level billing state.
-- ---------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid not null references organizations(id),
  member_id uuid not null references members(id),
  plan_id uuid not null references subscription_plans(id),
  frequency text not null check (frequency in ('annual','monthly','quarterly')),
  status text not null default 'pending'
    check (status in ('pending','active','past_due','paused','canceled','ended','trialing')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  enrolled_by uuid references profiles(id),
  enrolled_at timestamptz default now(),
  price_at_enrollment_cents int not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_member on subscriptions(member_id);
create index idx_subscriptions_status on subscriptions(status);
create index idx_subscriptions_enrolled_by on subscriptions(enrolled_by);
create index idx_subscriptions_opco on subscriptions(opco_id);

create or replace function public.touch_subscription_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_touch on subscriptions;
create trigger trg_subscriptions_touch
  before update on subscriptions
  for each row execute function public.touch_subscription_updated_at();

-- ---------------------------------------------------------------
-- 3. subscription_events — raw Stripe webhook audit log.
-- ---------------------------------------------------------------
create table subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id),
  stripe_event_id text unique not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz default now()
);

create index idx_subscription_events_type on subscription_events(event_type);
create index idx_subscription_events_processed on subscription_events(processed_at);
create index idx_subscription_events_subscription on subscription_events(subscription_id);

-- ---------------------------------------------------------------
-- 4. invoices — subscription + job-based invoice snapshots.
-- ---------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid not null references organizations(id),
  member_id uuid references members(id),
  subscription_id uuid references subscriptions(id),
  job_id uuid references jobs(id),
  stripe_invoice_id text unique,
  kind text not null check (kind in
    ('subscription_initial','subscription_renewal','subscription_upgrade','job_invoice','manual')),
  status text not null
    check (status in ('draft','open','paid','uncollectible','void')),
  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  amount_paid_cents int not null default 0,
  amount_remaining_cents int not null default 0,
  currency text not null default 'usd',
  issued_at timestamptz,
  paid_at timestamptz,
  due_at timestamptz,
  hosted_invoice_url text,
  pdf_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_invoices_member on invoices(member_id);
create index idx_invoices_subscription on invoices(subscription_id);
create index idx_invoices_job on invoices(job_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_opco on invoices(opco_id);

create or replace function public.touch_invoice_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_touch on invoices;
create trigger trg_invoices_touch
  before update on invoices
  for each row execute function public.touch_invoice_updated_at();

-- ---------------------------------------------------------------
-- 5. commissions — the earnings ledger.
-- ---------------------------------------------------------------
create table commissions (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid not null references organizations(id),
  profile_id uuid not null references profiles(id),
  kind text not null check (kind in
    ('cra_enrollment','cra_renewal','sales_manager_override','specialist_job')),
  source_type text not null check (source_type in ('subscription','invoice','job')),
  source_id uuid not null,
  basis_cents int not null,
  rate numeric(6,4),
  amount_cents int not null,
  status text not null default 'pending'
    check (status in ('pending','approved','paid','reversed','forfeited')),
  period_year int,
  period_month int,
  earned_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  paid_at timestamptz,
  paid_reference text,
  reversal_reason text,
  notes text,
  created_at timestamptz default now()
);

create index idx_commissions_profile on commissions(profile_id);
create index idx_commissions_status on commissions(status);
create index idx_commissions_period on commissions(period_year, period_month);
create index idx_commissions_source on commissions(source_type, source_id);
create index idx_commissions_opco on commissions(opco_id);

-- ---------------------------------------------------------------
-- 6. opco_stripe_accounts — Connect account wiring per OpCo.
-- ---------------------------------------------------------------
create table opco_stripe_accounts (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid not null unique references organizations(id),
  stripe_account_id text,
  account_type text default 'standard',
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  details_submitted boolean default false,
  onboarding_completed_at timestamptz,
  disabled_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.touch_opco_stripe_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_opco_stripe_touch on opco_stripe_accounts;
create trigger trg_opco_stripe_touch
  before update on opco_stripe_accounts
  for each row execute function public.touch_opco_stripe_updated_at();

-- ---------------------------------------------------------------
-- 7. Extensions to members + opportunities.
-- ---------------------------------------------------------------
alter table members
  add column if not exists stripe_customer_id text,
  add column if not exists default_payment_method text;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'members_stripe_customer_unique'
  ) then
    create unique index members_stripe_customer_unique
      on members(stripe_customer_id)
      where stripe_customer_id is not null;
  end if;
end$$;

alter table opportunities
  add column if not exists conversion_type text
    check (conversion_type in ('subscription','job','both','none'));

-- ---------------------------------------------------------------
-- 8. Helper: frequency pricing.
-- ---------------------------------------------------------------
create or replace function public.compute_frequency_price(
  p_annual_cents int,
  p_frequency text
)
returns int
language sql
immutable
as $$
  select case p_frequency
    when 'annual' then p_annual_cents
    when 'monthly' then (round(p_annual_cents::numeric * 1.15 / 12))::int
    when 'quarterly' then (round(p_annual_cents::numeric * 1.08 / 4))::int
    else p_annual_cents
  end;
$$;

-- ---------------------------------------------------------------
-- 9. Commission creation helpers.
-- ---------------------------------------------------------------
create or replace function public.create_cra_enrollment_commission(
  p_subscription_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
  v_plan subscription_plans%rowtype;
  v_commission_id uuid;
begin
  select * into v_sub from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'Subscription % not found', p_subscription_id;
  end if;
  if v_sub.enrolled_by is null then
    return null;
  end if;

  select * into v_plan from subscription_plans where id = v_sub.plan_id;

  -- Idempotent: if a cra_enrollment commission already exists for this
  -- subscription, return it instead of double-booking.
  select id into v_commission_id
  from commissions
  where kind = 'cra_enrollment'
    and source_type = 'subscription'
    and source_id = v_sub.id;
  if v_commission_id is not null then
    return v_commission_id;
  end if;

  insert into commissions (
    opco_id, profile_id, kind, source_type, source_id,
    basis_cents, rate, amount_cents, status,
    period_year, period_month, earned_at
  )
  values (
    v_sub.opco_id,
    v_sub.enrolled_by,
    'cra_enrollment',
    'subscription',
    v_sub.id,
    v_sub.price_at_enrollment_cents,
    null,
    v_plan.cra_enrollment_commission_cents,
    'pending',
    extract(year from v_sub.enrolled_at)::int,
    extract(month from v_sub.enrolled_at)::int,
    v_sub.enrolled_at
  )
  returning id into v_commission_id;

  return v_commission_id;
end;
$$;

grant execute on function public.create_cra_enrollment_commission(uuid)
  to authenticated;

create or replace function public.create_cra_renewal_residual(
  p_subscription_id uuid,
  p_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
  v_plan subscription_plans%rowtype;
  v_invoice invoices%rowtype;
  v_commission_id uuid;
  v_amount int;
begin
  select * into v_sub from subscriptions where id = p_subscription_id;
  if not found then return null; end if;
  if v_sub.enrolled_by is null then return null; end if;

  select * into v_plan from subscription_plans where id = v_sub.plan_id;
  select * into v_invoice from invoices where id = p_invoice_id;
  if not found then return null; end if;

  -- Idempotent guard: one residual per invoice.
  select id into v_commission_id
  from commissions
  where kind = 'cra_renewal'
    and source_type = 'invoice'
    and source_id = v_invoice.id;
  if v_commission_id is not null then
    return v_commission_id;
  end if;

  v_amount := (round(v_invoice.total_cents::numeric * v_plan.cra_renewal_residual_pct))::int;

  insert into commissions (
    opco_id, profile_id, kind, source_type, source_id,
    basis_cents, rate, amount_cents, status,
    period_year, period_month, earned_at
  )
  values (
    v_sub.opco_id,
    v_sub.enrolled_by,
    'cra_renewal',
    'invoice',
    v_invoice.id,
    v_invoice.total_cents,
    v_plan.cra_renewal_residual_pct,
    v_amount,
    'pending',
    extract(year from now())::int,
    extract(month from now())::int,
    now()
  )
  returning id into v_commission_id;

  return v_commission_id;
end;
$$;

grant execute on function public.create_cra_renewal_residual(uuid, uuid)
  to authenticated;

-- Sales manager override: 2% of collected subscription revenue for the
-- month, split across each sales manager based on the CRAs they manage.
-- For Phase 5 we use a simple proxy: every sales_manager in the OpCo
-- earns 2% of all subscription invoices paid that month. Production
-- hierarchy (manager ↔ CRA reports-to) lands in Phase 7 analytics.
create or replace function public.compute_sales_manager_overrides(
  p_year int,
  p_month int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_amount int;
  v_count int := 0;
begin
  for v_row in
    select
      i.opco_id,
      ur.user_id as profile_id,
      sum(i.total_cents) as basis
    from invoices i
    join user_roles ur
      on ur.opco_id = i.opco_id
     and ur.role = 'sales_manager'
    where i.status = 'paid'
      and i.kind in ('subscription_initial','subscription_renewal','subscription_upgrade')
      and extract(year from i.paid_at) = p_year
      and extract(month from i.paid_at) = p_month
    group by i.opco_id, ur.user_id
  loop
    v_amount := (round(v_row.basis * 0.02))::int;
    if v_amount <= 0 then continue; end if;

    -- Upsert-by-period: if we've already batched this manager for this
    -- period, update the amount in place.
    if exists (
      select 1 from commissions
      where kind = 'sales_manager_override'
        and profile_id = v_row.profile_id
        and period_year = p_year
        and period_month = p_month
    ) then
      update commissions
      set basis_cents = v_row.basis,
          amount_cents = v_amount
      where kind = 'sales_manager_override'
        and profile_id = v_row.profile_id
        and period_year = p_year
        and period_month = p_month;
    else
      insert into commissions (
        opco_id, profile_id, kind, source_type, source_id,
        basis_cents, rate, amount_cents, status,
        period_year, period_month, earned_at, notes
      )
      values (
        v_row.opco_id,
        v_row.profile_id,
        'sales_manager_override',
        'invoice',
        -- source_id is required; point at the OpCo as a synthetic anchor.
        v_row.opco_id,
        v_row.basis,
        0.0200,
        v_amount,
        'pending',
        p_year, p_month,
        now(),
        'Auto-generated monthly override'
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.compute_sales_manager_overrides(int, int)
  to authenticated;

-- Specialist job commission on job completion.
create or replace function public.create_specialist_job_commission(
  p_job_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jobs%rowtype;
  v_commission_id uuid;
  v_basis int;
  v_specialist uuid;
begin
  select * into v_job from jobs where id = p_job_id;
  if not found then return null; end if;
  if v_job.status <> 'completed' then return null; end if;

  -- jobs.specialist_id was added in Phase 1; Phase 4 also tracks
  -- specialists on the linked opportunity.
  v_specialist := v_job.specialist_id;
  if v_specialist is null and v_job.opportunity_id is not null then
    select coalesce(assigned_specialist_id, assigned_to)
    into v_specialist
    from opportunities where id = v_job.opportunity_id;
  end if;
  if v_specialist is null then return null; end if;

  -- Basis is the final amount if available, else the quoted amount.
  v_basis := coalesce(v_job.final_cents, v_job.quoted_cents, 0);
  if v_basis <= 0 then return null; end if;

  -- Idempotent: one per job.
  select id into v_commission_id
  from commissions
  where kind = 'specialist_job'
    and source_type = 'job'
    and source_id = v_job.id;
  if v_commission_id is not null then
    return v_commission_id;
  end if;

  insert into commissions (
    opco_id, profile_id, kind, source_type, source_id,
    basis_cents, rate, amount_cents, status,
    period_year, period_month, earned_at
  )
  values (
    v_job.opco_id,
    v_specialist,
    'specialist_job',
    'job',
    v_job.id,
    v_basis,
    0.0500,
    (round(v_basis * 0.05))::int,
    'pending',
    extract(year from coalesce(v_job.actual_end, now()))::int,
    extract(month from coalesce(v_job.actual_end, now()))::int,
    coalesce(v_job.actual_end, now())
  )
  returning id into v_commission_id;

  return v_commission_id;
end;
$$;

grant execute on function public.create_specialist_job_commission(uuid)
  to authenticated;

-- Trigger: fire specialist commission on job completion.
create or replace function public.jobs_completion_commission_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
  then
    perform public.create_specialist_job_commission(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_completion_commission on jobs;
create trigger trg_jobs_completion_commission
  after update on jobs
  for each row execute function public.jobs_completion_commission_trigger();

-- ---------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------
alter table subscription_plans enable row level security;
alter table subscriptions enable row level security;
alter table subscription_events enable row level security;
alter table invoices enable row level security;
alter table commissions enable row level security;
alter table opco_stripe_accounts enable row level security;

-- subscription_plans: global read for authenticated users, super admin writes.
drop policy if exists "subscription_plans_select" on subscription_plans;
create policy "subscription_plans_select" on subscription_plans
  for select using (true);

drop policy if exists "subscription_plans_super_admin_all" on subscription_plans;
create policy "subscription_plans_super_admin_all" on subscription_plans
  for all using (is_super_admin()) with check (is_super_admin());

-- subscriptions: tenant scoped.
drop policy if exists "subscriptions_tenant" on subscriptions;
create policy "subscriptions_tenant" on subscriptions for all
  using (opco_id = current_opco_id() or is_super_admin())
  with check (opco_id = current_opco_id() or is_super_admin());

-- subscription_events: chain through subscriptions; super admin + same opco.
drop policy if exists "subscription_events_tenant" on subscription_events;
create policy "subscription_events_tenant" on subscription_events for all
  using (
    is_super_admin()
    or exists (
      select 1 from subscriptions s
      where s.id = subscription_events.subscription_id
        and s.opco_id = current_opco_id()
    )
  )
  with check (
    is_super_admin()
    or exists (
      select 1 from subscriptions s
      where s.id = subscription_events.subscription_id
        and s.opco_id = current_opco_id()
    )
  );

-- invoices: tenant scoped.
drop policy if exists "invoices_tenant" on invoices;
create policy "invoices_tenant" on invoices for all
  using (opco_id = current_opco_id() or is_super_admin())
  with check (opco_id = current_opco_id() or is_super_admin());

-- commissions: tenant scoped, plus everyone can see their own.
drop policy if exists "commissions_select" on commissions;
create policy "commissions_select" on commissions for select
  using (
    is_super_admin()
    or profile_id = auth.uid()
    or (
      opco_id = current_opco_id()
      and (
        has_role('opco_gm')
        or has_role('sales_manager')
        or has_role('area_manager')
      )
    )
  );

drop policy if exists "commissions_insert" on commissions;
create policy "commissions_insert" on commissions for insert
  with check (opco_id = current_opco_id() or is_super_admin());

drop policy if exists "commissions_update" on commissions;
create policy "commissions_update" on commissions for update
  using (
    is_super_admin()
    or (opco_id = current_opco_id() and has_role('opco_gm'))
  )
  with check (
    is_super_admin()
    or (opco_id = current_opco_id() and has_role('opco_gm'))
  );

drop policy if exists "commissions_delete" on commissions;
create policy "commissions_delete" on commissions for delete
  using (is_super_admin());

-- opco_stripe_accounts: super admin + opco_gm of that OpCo.
drop policy if exists "opco_stripe_accounts_select" on opco_stripe_accounts;
create policy "opco_stripe_accounts_select" on opco_stripe_accounts for select
  using (
    is_super_admin()
    or (opco_id = current_opco_id() and has_role('opco_gm'))
  );

drop policy if exists "opco_stripe_accounts_write" on opco_stripe_accounts;
create policy "opco_stripe_accounts_write" on opco_stripe_accounts for all
  using (
    is_super_admin()
    or (opco_id = current_opco_id() and has_role('opco_gm'))
  )
  with check (
    is_super_admin()
    or (opco_id = current_opco_id() and has_role('opco_gm'))
  );
