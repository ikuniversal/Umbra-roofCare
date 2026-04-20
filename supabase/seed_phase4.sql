-- Phase 4 seed: crews, crew members, crew availability, backfilled
-- opportunity metadata, three quotes with line items, and ten jobs spread
-- across statuses.
--
-- Idempotent: every INSERT is guarded by a NOT EXISTS CTE on stable
-- identifiers (crew_code, quote_number, job_number).

-- ---------------------------------------------------------------
-- 0. Helpers: look up the two pilot opcos.
-- ---------------------------------------------------------------
-- We reference these via slug; if they don't exist the inserts quietly
-- become no-ops.

-- ---------------------------------------------------------------
-- 1. Crew lead profiles (orphan, no auth.users row).
-- ---------------------------------------------------------------
-- The profiles table FKs to auth.users, so we can't create crew leads
-- without real auth users. Instead we leave crews.lead_id null and rely
-- on the crew_members roster to identify leads. The seed's purpose is to
-- prove the UI; customers can reassign leads after provisioning real
-- users.

-- ---------------------------------------------------------------
-- 2. Crews.
-- ---------------------------------------------------------------
with specs as (
  select *
  from (values
    ('umbra-dfw', 'DFW-A', 'DFW Alpha', array['shingle','metal']::text[], 'Dallas, TX'),
    ('umbra-dfw', 'DFW-B', 'DFW Bravo', array['tile','shingle']::text[], 'Plano, TX'),
    ('umbra-dfw', 'DFW-C', 'DFW Charlie', array['rejuvenation','maintenance']::text[], 'Fort Worth, TX'),
    ('umbra-phx', 'PHX-A', 'PHX Alpha', array['shingle','metal']::text[], 'Phoenix, AZ'),
    ('umbra-phx', 'PHX-B', 'PHX Bravo', array['tile','flat']::text[], 'Scottsdale, AZ'),
    ('umbra-phx', 'PHX-C', 'PHX Charlie', array['rejuvenation','maintenance']::text[], 'Mesa, AZ')
  ) as t(slug, crew_code, name, specialties, home_base)
)
insert into crews (opco_id, crew_code, name, specialties, home_base, active, max_concurrent_jobs)
select o.id, s.crew_code, s.name, s.specialties, s.home_base, true, 1
from specs s
join organizations o on o.slug = s.slug
where not exists (
  select 1 from crews c
  where c.opco_id = o.id and c.crew_code = s.crew_code
);

-- ---------------------------------------------------------------
-- 3. Default working hours for every new crew.
-- ---------------------------------------------------------------
-- Mon-Fri 07:00-17:00, Sat 07:00-14:00. We key on the absence of any
-- working_hours row for the crew so re-runs don't duplicate.
insert into crew_availability (crew_id, kind, weekday, start_time, end_time, notes)
select c.id, 'working_hours', wd.weekday, wd.start_time::time, wd.end_time::time, 'Default'
from crews c
cross join (values
  (1, '07:00', '17:00'),
  (2, '07:00', '17:00'),
  (3, '07:00', '17:00'),
  (4, '07:00', '17:00'),
  (5, '07:00', '17:00'),
  (6, '07:00', '14:00')
) as wd(weekday, start_time, end_time)
where not exists (
  select 1 from crew_availability a
  where a.crew_id = c.id and a.kind = 'working_hours'
);

-- ---------------------------------------------------------------
-- 4. Backfill opportunity stages.
-- ---------------------------------------------------------------
-- The Phase 3 seed inserted 5 opportunities. We distribute them across
-- pipeline stages so the kanban has something to show, and give each a
-- value_estimate + expected_close_date.

-- 4.1: Use opportunity.opened_at ordering to get a stable mapping.
create temporary table _phase4_opp_map on commit drop as
select
  id,
  row_number() over (partition by opco_id order by opened_at asc) as rn,
  opco_id
from opportunities
where stage = 'prospecting'
  and value_estimate is null;

-- 4.2: Two prospecting (rn >= 3), one scheduled (rn=1 for each opco),
-- two quoted (rn=2). We only touch rows that still have the seed
-- defaults to avoid clobbering manual work.
update opportunities o
set
  stage = case
    when m.rn = 1 then 'scheduled'
    when m.rn = 2 then 'quoted'
    else 'prospecting'
  end,
  value_estimate = case
    when m.rn = 1 then 8900
    when m.rn = 2 then 12450
    when m.rn = 3 then 2800
    else 4200
  end,
  expected_close_date = (current_date + make_interval(days => (m.rn * 7)::int))::date
from _phase4_opp_map m
where m.id = o.id;

-- ---------------------------------------------------------------
-- 5. Quotes (three of them, one per OpCo-ish distribution).
-- ---------------------------------------------------------------
create temporary table _phase4_quote_map on commit drop as
select
  o.id as opportunity_id,
  o.opco_id,
  o.stage,
  o.member_id,
  org.slug,
  case
    when o.stage = 'scheduled' then 8900
    when o.stage = 'quoted' and o.value_estimate = 12450 then 12450
    when o.stage = 'quoted' and o.value_estimate = 2800 then 2800
  end as total
from opportunities o
join organizations org on org.id = o.opco_id
where o.stage in ('quoted','scheduled')
  and o.value_estimate in (8900, 12450, 2800);

-- Create quotes — one per opportunity in the map.
insert into quotes (
  opco_id, opportunity_id, quote_number, status, prepared_by, valid_until,
  subtotal_materials, subtotal_labor, tax_rate, tax_amount, total,
  notes, terms
)
select
  m.opco_id,
  m.opportunity_id,
  public.generate_quote_number(m.opco_id),
  case when m.stage = 'scheduled' then 'accepted' else 'sent' end,
  null,
  (current_date + make_interval(days => 30))::date,
  round(m.total::numeric * 0.55, 2),
  round(m.total::numeric * 0.30, 2),
  0.0825,
  round(m.total::numeric * 0.0625, 2),
  m.total,
  'Umbra-prepared quote from Phase 4 demo seed.',
  'Deposit due at acceptance. Remaining balance on completion.'
from _phase4_quote_map m
where not exists (
  select 1 from quotes q where q.opportunity_id = m.opportunity_id
);

-- ---------------------------------------------------------------
-- 6. Quote line items — one template per $ band.
-- ---------------------------------------------------------------
-- $12,450 replacement (6 lines), $2,800 repair (4 lines), $8,900 replacement (7 lines).

-- $12,450 quote
insert into quote_line_items (quote_id, kind, description, quantity, unit, unit_price, line_total, sort_order)
select q.id, t.kind, t.description, t.quantity, t.unit, t.unit_price, t.quantity * t.unit_price, t.sort_order
from quotes q
join _phase4_quote_map m on m.opportunity_id = q.opportunity_id and m.total = 12450
cross join (values
  ('material', 'Architectural composition shingles', 28, 'sq', 160, 1),
  ('material', 'Synthetic underlayment', 6, 'roll', 120, 2),
  ('material', 'Ice & water shield, valleys + edges', 4, 'roll', 90, 3),
  ('labor', 'Tear-off existing roof system', 1, 'lot', 2200, 4),
  ('labor', 'Install new roof system', 1, 'lot', 4800, 5),
  ('fee', 'Debris haul + disposal', 1, 'lot', 420, 6)
) as t(kind, description, quantity, unit, unit_price, sort_order)
where not exists (
  select 1 from quote_line_items li where li.quote_id = q.id
);

-- $2,800 quote
insert into quote_line_items (quote_id, kind, description, quantity, unit, unit_price, line_total, sort_order)
select q.id, t.kind, t.description, t.quantity, t.unit, t.unit_price, t.quantity * t.unit_price, t.sort_order
from quotes q
join _phase4_quote_map m on m.opportunity_id = q.opportunity_id and m.total = 2800
cross join (values
  ('material', 'Matching replacement shingles', 2, 'sq', 180, 1),
  ('material', 'Flashing kit + sealant', 1, 'kit', 140, 2),
  ('labor', 'Targeted repair: south slope', 6, 'hr', 120, 3),
  ('fee', 'Mobilization + cleanup', 1, 'lot', 140, 4)
) as t(kind, description, quantity, unit, unit_price, sort_order)
where not exists (
  select 1 from quote_line_items li where li.quote_id = q.id
);

-- $8,900 quote
insert into quote_line_items (quote_id, kind, description, quantity, unit, unit_price, line_total, sort_order)
select q.id, t.kind, t.description, t.quantity, t.unit, t.unit_price, t.quantity * t.unit_price, t.sort_order
from quotes q
join _phase4_quote_map m on m.opportunity_id = q.opportunity_id and m.total = 8900
cross join (values
  ('material', 'Architectural shingles', 22, 'sq', 155, 1),
  ('material', 'Underlayment', 4, 'roll', 115, 2),
  ('material', 'Drip edge + starters', 1, 'lot', 260, 3),
  ('material', 'Ridge cap + vents', 1, 'lot', 320, 4),
  ('labor', 'Tear-off + reroof', 1, 'lot', 3400, 5),
  ('fee', 'Permits + disposal', 1, 'lot', 320, 6),
  ('discount', 'Member loyalty credit', 1, 'credit', 180, 7)
) as t(kind, description, quantity, unit, unit_price, sort_order)
where not exists (
  select 1 from quote_line_items li where li.quote_id = q.id
);

-- ---------------------------------------------------------------
-- 7. Jobs — ten across statuses.
-- ---------------------------------------------------------------
create temporary table _phase4_job_templates on commit drop as
select * from (values
  -- (job_number_suffix, status, days_from_now, job_type, priority, final_cents, notes)
  ('RTS-1', 'ready_to_schedule', null::int, 'repair', 'normal', null::int, 'Awaiting dispatch.'),
  ('RTS-2', 'ready_to_schedule', null::int, 'maintenance', 'low', null::int, 'Pending crew availability.'),
  ('SCH-1', 'scheduled', 3, 'replacement', 'high', null::int, 'Scheduled for next week.'),
  ('SCH-2', 'scheduled', 5, 'repair', 'normal', null::int, 'Minor repair.'),
  ('SCH-3', 'scheduled', 8, 'rejuvenation', 'normal', null::int, 'Rejuvenation pass.'),
  ('WIP-1', 'in_progress', 0, 'replacement', 'high', null::int, 'Tear-off in progress.'),
  ('WIP-2', 'in_progress', 0, 'repair', 'urgent', null::int, 'Active leak response.'),
  ('DONE-1', 'completed', -3, 'repair', 'normal', 285000, 'Replacement completed successfully.'),
  ('DONE-2', 'completed', -10, 'replacement', 'high', 1245000, 'Full roof replacement.'),
  ('DONE-3', 'completed', -15, 'rejuvenation', 'normal', 420000, 'Rejuvenation package.'),
  ('DONE-4', 'completed', -22, 'maintenance', 'normal', 89000, 'Annual maintenance visit.'),
  ('CAN-1', 'cancelled', -5, 'repair', 'normal', null::int, 'Member cancelled; reassessing.')
) as t(suffix, status, offset_days, job_type, priority, final_cents, notes);

-- We need (member_id, property_id, opco_id, crew_id) for each row. Use
-- the first N members in each OpCo for a stable mapping.
create temporary table _phase4_job_targets on commit drop as
with assigned as (
  select
    m.id as member_id,
    m.opco_id,
    p.id as property_id,
    org.slug,
    row_number() over (partition by m.opco_id order by m.created_at asc) as rn
  from members m
  join properties p on p.member_id = m.id and p.is_primary
  join organizations org on org.id = m.opco_id
)
select
  a.*,
  c.id as crew_id
from assigned a
left join crews c
  on c.opco_id = a.opco_id
 and c.crew_code = case a.slug
   when 'umbra-dfw' then
     case (a.rn % 3)
       when 1 then 'DFW-A'
       when 2 then 'DFW-B'
       else 'DFW-C'
     end
   when 'umbra-phx' then
     case (a.rn % 3)
       when 1 then 'PHX-A'
       when 2 then 'PHX-B'
       else 'PHX-C'
     end
 end
where a.rn <= 12;

-- Pair each template with a target round-robin.
create temporary table _phase4_job_plan on commit drop as
with tpl_numbered as (
  select t.*, row_number() over (order by t.suffix) as rn
  from _phase4_job_templates t
),
targets_numbered as (
  select tg.*, row_number() over (order by tg.opco_id, tg.rn) as tn
  from _phase4_job_targets tg
)
select
  tp.suffix,
  tp.status,
  tp.offset_days,
  tp.job_type,
  tp.priority,
  tp.final_cents,
  tp.notes,
  tg.member_id,
  tg.opco_id,
  tg.property_id,
  case when tp.status in ('ready_to_schedule','cancelled') then null else tg.crew_id end as crew_id
from tpl_numbered tp
join targets_numbered tg on ((tp.rn - 1) % (select count(*) from targets_numbered)) + 1 = tg.tn;

-- Insert jobs.
insert into jobs (
  opco_id,
  member_id,
  property_id,
  job_type,
  status,
  priority,
  crew_id,
  scheduled_start,
  scheduled_end,
  actual_start,
  actual_end,
  job_number,
  scope_summary,
  notes,
  final_cents
)
select
  p.opco_id,
  p.member_id,
  p.property_id,
  p.job_type,
  p.status,
  p.priority,
  p.crew_id,
  case when p.offset_days is not null
    then (now() + (p.offset_days || ' days')::interval + interval '8 hours')
    else null end,
  case when p.offset_days is not null
    then (now() + (p.offset_days || ' days')::interval + interval '16 hours')
    else null end,
  case when p.status in ('in_progress','completed')
    then (now() + (coalesce(p.offset_days, 0) || ' days')::interval + interval '8 hours')
    else null end,
  case when p.status = 'completed'
    then (now() + (coalesce(p.offset_days, 0) || ' days')::interval + interval '16 hours')
    else null end,
  'SEED-' || p.suffix,
  'Phase 4 demo job · ' || p.notes,
  p.notes,
  p.final_cents
from _phase4_job_plan p
where not exists (
  select 1 from jobs j where j.job_number = 'SEED-' || p.suffix
);

-- ---------------------------------------------------------------
-- 8. Activity trail for the seeded pieces.
-- ---------------------------------------------------------------
insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  c.opco_id, null, 'crew', c.id, 'crew.created',
  jsonb_build_object('crew_code', c.crew_code, 'source', 'seed_phase4')
from crews c
where not exists (
  select 1 from activity_log a
  where a.entity_id = c.id and a.action = 'crew.created'
);

insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  q.opco_id, null, 'quote', q.id, 'quote.created',
  jsonb_build_object('quote_number', q.quote_number, 'source', 'seed_phase4')
from quotes q
where not exists (
  select 1 from activity_log a
  where a.entity_id = q.id and a.action = 'quote.created'
);

insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  j.opco_id, null, 'job', j.id, 'job.scheduled',
  jsonb_build_object('scheduled_start', j.scheduled_start)
from jobs j
where j.job_number like 'SEED-%'
  and j.status != 'ready_to_schedule'
  and j.scheduled_start is not null
  and not exists (
    select 1 from activity_log a
    where a.entity_id = j.id and a.action = 'job.scheduled'
  );
