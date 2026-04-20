-- Phase 5 seed: 4 subscription plans, 4 demo subscriptions, 8 invoices,
-- and 9 commissions. Idempotent — every insert is guarded by NOT EXISTS
-- on stable keys (plan code, subscription id via stripe_subscription_id,
-- invoice stripe_invoice_id, commission source_id + kind).

-- ---------------------------------------------------------------
-- 1. subscription_plans (the 4 Umbra tiers).
-- ---------------------------------------------------------------
insert into subscription_plans (
  code, name, tier_level,
  annual_price_cents, monthly_price_cents, quarterly_price_cents,
  features,
  cra_enrollment_commission_cents, cra_renewal_residual_pct
)
select * from (values
  (
    'basic', 'Basic', 1,
    22900, 2195, 6183,
    jsonb_build_array(
      'Annual roof inspection',
      'Priority scheduling',
      'Member pricing on repairs'
    ),
    4000, 0.0500
  ),
  (
    'standard', 'Standard', 2,
    44900, 4303, 12123,
    jsonb_build_array(
      'Bi-annual inspections',
      'Priority scheduling',
      '10% member discount on repairs',
      'Gutter cleaning (1× / year)'
    ),
    8000, 0.0700
  ),
  (
    'premium', 'Premium', 3,
    69900, 6699, 18873,
    jsonb_build_array(
      'Quarterly inspections',
      'Emergency response (24h)',
      '15% member discount on repairs',
      'Gutter cleaning (2× / year)',
      'Minor repairs included'
    ),
    12000, 0.0800
  ),
  (
    'elite', 'Elite', 4,
    89900, 8615, 24273,
    jsonb_build_array(
      'Bi-monthly inspections',
      '24/7 emergency response',
      '20% member discount on repairs',
      'Gutter cleaning (3× / year)',
      'Minor repairs included',
      'Rejuvenation package',
      'Dedicated CSM'
    ),
    15000, 0.1000
  )
) as t(
  code, name, tier_level,
  annual_price_cents, monthly_price_cents, quarterly_price_cents,
  features,
  cra_enrollment_commission_cents, cra_renewal_residual_pct
)
where not exists (
  select 1 from subscription_plans p where p.code = t.code
);

-- ---------------------------------------------------------------
-- 2. subscriptions — tie to the first 4 members by insertion order.
-- ---------------------------------------------------------------
-- Map: 1→Premium/annual (active), 2→Standard/annual (active),
--      3→Basic/monthly (active), 4→Elite/annual (canceled 90d ago).

create temporary table _phase5_sub_map on commit drop as
with numbered as (
  -- Global row_number (no opco partition) — each spec suffix maps to
  -- exactly ONE member, otherwise multiple OpCos would each try to
  -- insert the same `sub_DEMO_NNN` placeholder and collide on the
  -- stripe_subscription_id unique constraint.
  select
    m.id as member_id,
    m.opco_id,
    row_number() over (order by m.opco_id asc, m.created_at asc, m.id asc) as rn
  from members m
)
select
  n.member_id,
  n.opco_id,
  plan.id as plan_id,
  plan.code,
  plan.annual_price_cents,
  plan.monthly_price_cents,
  case spec.stripe_sub_id_suffix
    when '001' then 'premium'
    when '002' then 'standard'
    when '003' then 'basic'
    when '004' then 'elite'
  end as want_code,
  spec.stripe_sub_id_suffix,
  spec.frequency,
  spec.status,
  spec.enrolled_days_ago,
  spec.canceled_days_ago,
  spec.rn_target
from numbered n
cross join (values
  ('001', 'premium',   'annual',  'active',   380, null::int,  1),
  ('002', 'standard',  'annual',  'active',   190, null::int,  2),
  ('003', 'basic',     'monthly', 'active',    60, null::int,  3),
  ('004', 'elite',     'annual',  'canceled', 180, 90,         4)
) as spec(stripe_sub_id_suffix, want_code, frequency, status, enrolled_days_ago, canceled_days_ago, rn_target)
join subscription_plans plan on plan.code = spec.want_code
where n.rn = spec.rn_target;

insert into subscriptions (
  opco_id, member_id, plan_id, frequency, status,
  stripe_customer_id, stripe_subscription_id,
  current_period_start, current_period_end,
  canceled_at, cancellation_reason,
  enrolled_by, enrolled_at,
  price_at_enrollment_cents, notes
)
select
  m.opco_id,
  m.member_id,
  m.plan_id,
  m.frequency,
  m.status,
  'cus_DEMO_' || m.stripe_sub_id_suffix,
  'sub_DEMO_' || m.stripe_sub_id_suffix,
  (now() - make_interval(days => m.enrolled_days_ago))::timestamptz,
  case m.frequency
    when 'annual' then (now() - make_interval(days => m.enrolled_days_ago) + make_interval(days => 365))::timestamptz
    when 'monthly' then (now() - make_interval(days => m.enrolled_days_ago) + make_interval(days => 30))::timestamptz
    when 'quarterly' then (now() - make_interval(days => m.enrolled_days_ago) + make_interval(days => 92))::timestamptz
  end,
  case when m.canceled_days_ago is not null
    then (now() - make_interval(days => m.canceled_days_ago))::timestamptz
    else null
  end,
  case when m.canceled_days_ago is not null then 'Seed demo cancellation' else null end,
  null,
  (now() - make_interval(days => m.enrolled_days_ago))::timestamptz,
  public.compute_frequency_price(m.annual_price_cents, m.frequency),
  'Seeded Phase 5 subscription · ' || m.stripe_sub_id_suffix
from _phase5_sub_map m
where not exists (
  select 1 from subscriptions s
  where s.stripe_subscription_id = 'sub_DEMO_' || m.stripe_sub_id_suffix
);

-- ---------------------------------------------------------------
-- 3. invoices — 8 total.
-- ---------------------------------------------------------------
-- Subscription 001 (Premium annual, 380d ago): initial + renewal at 365d.
-- Subscription 002 (Standard annual, 190d ago): initial only.
-- Subscription 003 (Basic monthly, 60d ago): initial + 1 renewal.
-- Subscription 004 (Elite annual canceled): initial + 1 renewal (before cancel).
-- Plus 2 extra renewals to reach 8 total: sub 001 gets a 2nd renewal,
-- sub 002 gets a manual invoice.

create temporary table _phase5_invoice_specs on commit drop as
select * from (values
  ('001', 'subscription_initial',  'paid', 380, 69900),
  ('001', 'subscription_renewal',  'paid',  15, 69900),
  ('001', 'subscription_renewal',  'open',  -5, 69900),   -- 5 days from now, still open
  ('002', 'subscription_initial',  'paid', 190, 44900),
  ('002', 'manual',                'paid', 120, 12500),   -- manual add-on
  ('003', 'subscription_initial',  'paid',  60, 2195),
  ('003', 'subscription_renewal',  'paid',  30, 2195),
  ('004', 'subscription_initial',  'paid', 180, 89900)
) as t(sub_suffix, kind, status, issued_days_ago, amount_cents);

insert into invoices (
  opco_id, member_id, subscription_id,
  stripe_invoice_id, kind, status,
  subtotal_cents, tax_cents, total_cents,
  amount_paid_cents, amount_remaining_cents,
  currency, issued_at, paid_at, due_at,
  hosted_invoice_url, notes
)
select
  s.opco_id,
  s.member_id,
  s.id,
  'in_DEMO_' || spec.sub_suffix || '_' || abs(spec.issued_days_ago) || '_' || spec.kind,
  spec.kind,
  spec.status,
  spec.amount_cents,
  0,
  spec.amount_cents,
  case spec.status when 'paid' then spec.amount_cents else 0 end,
  case spec.status when 'paid' then 0 else spec.amount_cents end,
  'usd',
  (now() - make_interval(days => spec.issued_days_ago))::timestamptz,
  case spec.status when 'paid'
    then (now() - make_interval(days => spec.issued_days_ago) + make_interval(days => 1))::timestamptz
    else null
  end,
  (now() - make_interval(days => spec.issued_days_ago) + make_interval(days => 30))::timestamptz,
  'https://invoice.stripe.com/DEMO/' || spec.sub_suffix,
  'Seed Phase 5 invoice'
from _phase5_invoice_specs spec
join subscriptions s on s.stripe_subscription_id = 'sub_DEMO_' || spec.sub_suffix
where not exists (
  select 1 from invoices i
  where i.stripe_invoice_id =
    'in_DEMO_' || spec.sub_suffix || '_' || abs(spec.issued_days_ago) || '_' || spec.kind
);

-- ---------------------------------------------------------------
-- 4. Assign an enrolled_by for each demo subscription.
-- ---------------------------------------------------------------
-- Pick the oldest profile in the OpCo with a role in the "sellable"
-- set. This lets commissions downstream reference a real profile.
update subscriptions s
set enrolled_by = (
  select ur.user_id
  from user_roles ur
  where ur.opco_id = s.opco_id
    and ur.role in ('cra','specialist','csm','opco_gm','sales_manager')
  order by ur.granted_at asc
  limit 1
)
where s.stripe_subscription_id like 'sub_DEMO_%'
  and s.enrolled_by is null;

-- ---------------------------------------------------------------
-- 5. Commissions.
-- ---------------------------------------------------------------
-- 5a. CRA enrollment (4 commissions, one per seeded subscription).
insert into commissions (
  opco_id, profile_id, kind, source_type, source_id,
  basis_cents, rate, amount_cents, status,
  period_year, period_month, earned_at,
  notes
)
select
  s.opco_id,
  s.enrolled_by,
  'cra_enrollment',
  'subscription',
  s.id,
  s.price_at_enrollment_cents,
  null,
  p.cra_enrollment_commission_cents,
  'pending',
  extract(year from s.enrolled_at)::int,
  extract(month from s.enrolled_at)::int,
  s.enrolled_at,
  'Seeded enrollment commission'
from subscriptions s
join subscription_plans p on p.id = s.plan_id
where s.stripe_subscription_id like 'sub_DEMO_%'
  and s.enrolled_by is not null
  and not exists (
    select 1 from commissions c
    where c.kind = 'cra_enrollment'
      and c.source_type = 'subscription'
      and c.source_id = s.id
  );

-- 5b. CRA renewal residuals for the annual subs with a paid renewal.
-- Sub 001 has a paid renewal at day -15; sub 004 has only the initial.
insert into commissions (
  opco_id, profile_id, kind, source_type, source_id,
  basis_cents, rate, amount_cents, status,
  period_year, period_month, earned_at,
  notes
)
select
  s.opco_id,
  s.enrolled_by,
  'cra_renewal',
  'invoice',
  i.id,
  i.total_cents,
  p.cra_renewal_residual_pct,
  (round(i.total_cents * p.cra_renewal_residual_pct))::int,
  'pending',
  extract(year from i.paid_at)::int,
  extract(month from i.paid_at)::int,
  i.paid_at,
  'Seeded renewal residual'
from invoices i
join subscriptions s on s.id = i.subscription_id
join subscription_plans p on p.id = s.plan_id
where i.kind = 'subscription_renewal'
  and i.status = 'paid'
  and s.enrolled_by is not null
  and not exists (
    select 1 from commissions c
    where c.kind = 'cra_renewal'
      and c.source_type = 'invoice'
      and c.source_id = i.id
  );

-- 5c. Sales manager override: pick one sales_manager user (any opco) and
-- synthesize a monthly override record for last month.
-- Idempotent via an explicit NOT EXISTS on (kind, profile_id, period).
-- `on conflict do nothing` without a target is a no-op here because the
-- commissions PK is a random uuid — it never collides.
with override_target as (
  select
    ur.opco_id,
    ur.user_id as profile_id,
    extract(year from (now() - make_interval(months => 1)))::int as period_year,
    extract(month from (now() - make_interval(months => 1)))::int as period_month
  from user_roles ur
  where ur.role = 'sales_manager'
  limit 1
)
insert into commissions (
  opco_id, profile_id, kind, source_type, source_id,
  basis_cents, rate, amount_cents, status,
  period_year, period_month, earned_at,
  notes
)
select
  t.opco_id,
  t.profile_id,
  'sales_manager_override',
  'invoice',
  t.opco_id,
  150000,
  0.0200,
  3000,
  'pending',
  t.period_year,
  t.period_month,
  (now() - make_interval(days => 15))::timestamptz,
  'Seeded monthly override · run compute_sales_manager_overrides() in prod'
from override_target t
where not exists (
  select 1 from commissions c
  where c.kind = 'sales_manager_override'
    and c.profile_id = t.profile_id
    and c.period_year = t.period_year
    and c.period_month = t.period_month
);

-- 5d. Specialist job commission for up to 2 completed seeded jobs.
insert into commissions (
  opco_id, profile_id, kind, source_type, source_id,
  basis_cents, rate, amount_cents, status,
  period_year, period_month, earned_at,
  notes
)
select
  j.opco_id,
  coalesce(j.specialist_id, j.project_manager_id, s.enrolled_by) as profile_id,
  'specialist_job',
  'job',
  j.id,
  coalesce(j.final_cents, j.quoted_cents, 0),
  0.0500,
  (round(coalesce(j.final_cents, j.quoted_cents, 0) * 0.05))::int,
  'pending',
  extract(year from coalesce(j.actual_end, j.created_at))::int,
  extract(month from coalesce(j.actual_end, j.created_at))::int,
  coalesce(j.actual_end, j.created_at),
  'Seeded specialist commission · demo'
from jobs j
left join lateral (
  select s.* from subscriptions s
  where s.member_id = j.member_id and s.opco_id = j.opco_id
  order by s.enrolled_at desc limit 1
) s on true
where j.status = 'completed'
  and j.job_number like 'SEED-DONE-%'
  and coalesce(j.final_cents, j.quoted_cents, 0) > 0
  and coalesce(j.specialist_id, j.project_manager_id, s.enrolled_by) is not null
  and not exists (
    select 1 from commissions c
    where c.kind = 'specialist_job'
      and c.source_type = 'job'
      and c.source_id = j.id
  )
limit 2;

-- 5e. Mark the earliest cra_enrollment commission as 'paid' so the UI
-- can show the paid-state row. Idempotent: only runs if no cra_enrollment
-- has already been marked paid by a prior seed run.
update commissions
set status = 'paid',
    approved_at = (now() - make_interval(days => 20))::timestamptz,
    paid_at = (now() - make_interval(days => 10))::timestamptz,
    paid_reference = 'DEMO-PAYROLL-2026-04'
where id in (
  select id from commissions
  where kind = 'cra_enrollment'
    and status = 'pending'
  order by earned_at asc
  limit 1
)
and not exists (
  select 1 from commissions
  where kind = 'cra_enrollment' and status = 'paid'
);

-- ---------------------------------------------------------------
-- 6. opco_stripe_accounts — seed placeholder rows for both pilot OpCos.
-- ---------------------------------------------------------------
insert into opco_stripe_accounts (opco_id, charges_enabled, payouts_enabled, details_submitted)
select id, false, false, false
from organizations
where type = 'opco'
on conflict (opco_id) do nothing;

-- ---------------------------------------------------------------
-- 7. Activity trail.
-- ---------------------------------------------------------------
insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  s.opco_id, null, 'subscription', s.id, 'subscription.enrolled',
  jsonb_build_object('source', 'seed_phase5', 'plan', p.code, 'frequency', s.frequency)
from subscriptions s
join subscription_plans p on p.id = s.plan_id
where s.stripe_subscription_id like 'sub_DEMO_%'
  and not exists (
    select 1 from activity_log a
    where a.entity_id = s.id and a.action = 'subscription.enrolled'
  );

insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  c.opco_id, null, 'commission', c.id, 'commission.created',
  jsonb_build_object('kind', c.kind, 'amount', c.amount_cents, 'source', 'seed_phase5')
from commissions c
where c.notes like 'Seed%'
  and not exists (
    select 1 from activity_log a
    where a.entity_id = c.id and a.action = 'commission.created'
  );
