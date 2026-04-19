-- Phase 2 demo seed (idempotent, no DO block, no temp tables).
--
-- Designed for the Supabase SQL Editor: each statement uses CTEs and
-- inline (SELECT ... FROM organizations WHERE slug = '…') subqueries
-- instead of PL/pgSQL declared variables, so the editor can execute
-- the file end-to-end without parser quirks and you can see row counts
-- after every statement.
--
-- Idempotency: every insert is gated by NOT EXISTS, so running this
-- twice will only fill in what's missing — it never duplicates rows.
--
-- User attribution: when an OpCo has no users yet, primary_cra_id and
-- created_by fall back to the oldest profile in the database (in the
-- pilot, that's the bootstrap super_admin). Once you invite real OpCo
-- staff, those FKs continue to point at the original creator — feel
-- free to UPDATE them later.

-- ---------------------------------------------------------------------
-- 1. Territories (DFW)
-- ---------------------------------------------------------------------
insert into territories (opco_id, name, zip_codes, total_doors, active)
select
  (select id from organizations where slug = 'umbra-dfw'),
  v.name,
  v.zips,
  v.doors,
  true
from (values
  ('Downtown Dallas',       array['75201','75202','75204']::text[], 3200),
  ('Fort Worth West',       array['76107','76109']::text[],         2800),
  ('North Dallas Corridor', array['75204']::text[],                 1900)
) as v(name, zips, doors)
where (select id from organizations where slug = 'umbra-dfw') is not null
  and not exists (
    select 1 from territories t
    where t.opco_id = (select id from organizations where slug = 'umbra-dfw')
      and t.name = v.name
  );

-- ---------------------------------------------------------------------
-- 2. Territories (Phoenix)
-- ---------------------------------------------------------------------
insert into territories (opco_id, name, zip_codes, total_doors, active)
select
  (select id from organizations where slug = 'umbra-phx'),
  v.name,
  v.zips,
  v.doors,
  true
from (values
  ('Central Phoenix',     array['85003','85004']::text[], 2400),
  ('Arcadia / Biltmore',  array['85008','85018']::text[], 2100),
  ('Downtown Phoenix',    array['85001','85003']::text[], 1600)
) as v(name, zips, doors)
where (select id from organizations where slug = 'umbra-phx') is not null
  and not exists (
    select 1 from territories t
    where t.opco_id = (select id from organizations where slug = 'umbra-phx')
      and t.name = v.name
  );

-- ---------------------------------------------------------------------
-- 3. Members + primary properties (DFW)
--    Single chained CTE: insert the member, then insert its primary
--    property using the returned id. Members already in the table are
--    skipped (NOT EXISTS on email within the OpCo).
-- ---------------------------------------------------------------------
with
opco as (
  select id from organizations where slug = 'umbra-dfw'
),
seed_user as (
  select coalesce(
    (select p.id from profiles p where p.opco_id = (select id from opco)
       order by p.created_at asc limit 1),
    (select p.id from profiles p order by p.created_at asc limit 1)
  ) as uid
),
src as (
  select * from (values
    ('Angela',  'Harris',    'angela.harris@example.com',    '214-555-0114', 'member',   '1842 Oak Lawn Ave',   'Dallas',     'TX', '75201', 'composition_shingle', 18, 2100, 2),
    ('Marcus',  'Bennett',   'marcus.bennett@example.com',   '214-555-0128', 'member',   '2917 Swiss Ave',      'Dallas',     'TX', '75204', 'composition_shingle', 22, 2600, 2),
    ('Priya',   'Desai',     'priya.desai@example.com',      '214-555-0132', 'prospect', '425 S Akard St',      'Dallas',     'TX', '75202', 'composition_shingle', 14, 1900, 2),
    ('Jonas',   'Whitfield', 'jonas.whitfield@example.com',  '214-555-0147', 'member',   '3011 McKinney Ave',   'Dallas',     'TX', '75204', 'standing_seam_metal',  9, 2400, 2),
    ('Sofia',   'Ramirez',   'sofia.ramirez@example.com',    '214-555-0155', 'member',   '1515 Main St',        'Dallas',     'TX', '75201', 'composition_shingle', 20, 2200, 2),
    ('Trent',   'Okafor',    'trent.okafor@example.com',     '817-555-0163', 'prospect', '3400 Camp Bowie Blvd','Fort Worth', 'TX', '76107', 'composition_shingle', 25, 2000, 1),
    ('Rachel',  'Nguyen',    'rachel.nguyen@example.com',    '817-555-0172', 'member',   '2812 W 7th St',       'Fort Worth', 'TX', '76107', 'composition_shingle', 12, 2300, 2),
    ('Devon',   'Alvarez',   'devon.alvarez@example.com',    '817-555-0185', 'paused',   '5015 Byers Ave',      'Fort Worth', 'TX', '76107', 'composition_shingle', 28, 1850, 1),
    ('Hannah',  'Kowalski',  'hannah.kowalski@example.com',  '817-555-0193', 'prospect', '6401 Trail Lake Dr',  'Fort Worth', 'TX', '76109', 'composition_shingle', 16, 2550, 2),
    ('Eli',     'Brooks',    'eli.brooks@example.com',       '214-555-0208', 'member',   '2200 Ross Ave',       'Dallas',     'TX', '75201', 'composition_shingle', 21, 2750, 2)
  ) as v(first_name, last_name, email, phone, status, street, city, state, zip, roof_material, roof_age_years, square_footage, stories)
),
new_members as (
  insert into members (opco_id, first_name, last_name, email, phone, source, status, preferred_contact, primary_cra_id, created_by)
  select
    (select id from opco),
    s.first_name, s.last_name, s.email, s.phone,
    'canvass', s.status, 'email',
    (select uid from seed_user),
    (select uid from seed_user)
  from src s
  where (select id from opco) is not null
    and (select uid from seed_user) is not null
    and not exists (
      select 1 from members m
      where m.opco_id = (select id from opco)
        and m.email = s.email
    )
  returning id, email
)
insert into properties (member_id, opco_id, is_primary, street, city, state, zip, roof_material, roof_age_years, square_footage, stories)
select
  nm.id,
  (select id from opco),
  true,
  s.street, s.city, s.state, s.zip,
  s.roof_material, s.roof_age_years, s.square_footage, s.stories
from new_members nm
join src s on s.email = nm.email;

-- ---------------------------------------------------------------------
-- 4. Members + primary properties (Phoenix)
-- ---------------------------------------------------------------------
with
opco as (
  select id from organizations where slug = 'umbra-phx'
),
seed_user as (
  select coalesce(
    (select p.id from profiles p where p.opco_id = (select id from opco)
       order by p.created_at asc limit 1),
    (select p.id from profiles p order by p.created_at asc limit 1)
  ) as uid
),
src as (
  select * from (values
    ('Olivia', 'Castellanos', 'olivia.castellanos@example.com', '602-555-0221', 'member',   '1401 N Central Ave',     'Phoenix', 'AZ', '85004', 'tile_concrete',        18, 2250, 1),
    ('Marcus', 'Lee',         'marcus.lee@example.com',         '602-555-0238', 'prospect', '2700 N 3rd St',          'Phoenix', 'AZ', '85004', 'tile_concrete',        15, 2100, 1),
    ('Aisha',  'Nasser',      'aisha.nasser@example.com',       '602-555-0244', 'member',   '4602 E Indian School Rd','Phoenix', 'AZ', '85018', 'tile_concrete',        20, 2700, 1),
    ('Carlos', 'Mendoza',     'carlos.mendoza@example.com',     '602-555-0259', 'member',   '3812 E Camelback Rd',    'Phoenix', 'AZ', '85018', 'standing_seam_metal',   7, 2400, 2),
    ('Reza',   'Khan',        'reza.khan@example.com',          '602-555-0266', 'prospect', '901 W Washington St',    'Phoenix', 'AZ', '85003', 'composition_shingle',  19, 1800, 1)
  ) as v(first_name, last_name, email, phone, status, street, city, state, zip, roof_material, roof_age_years, square_footage, stories)
),
new_members as (
  insert into members (opco_id, first_name, last_name, email, phone, source, status, preferred_contact, primary_cra_id, created_by)
  select
    (select id from opco),
    s.first_name, s.last_name, s.email, s.phone,
    'canvass', s.status, 'email',
    (select uid from seed_user),
    (select uid from seed_user)
  from src s
  where (select id from opco) is not null
    and (select uid from seed_user) is not null
    and not exists (
      select 1 from members m
      where m.opco_id = (select id from opco)
        and m.email = s.email
    )
  returning id, email
)
insert into properties (member_id, opco_id, is_primary, street, city, state, zip, roof_material, roof_age_years, square_footage, stories)
select
  nm.id,
  (select id from opco),
  true,
  s.street, s.city, s.state, s.zip,
  s.roof_material, s.roof_age_years, s.square_footage, s.stories
from new_members nm
join src s on s.email = nm.email;

-- ---------------------------------------------------------------------
-- 5. Canvass leads
--    OpCo, territory, and (when attempts > 0) the contacted_by user are
--    resolved inline. Idempotent on (opco_id, address).
-- ---------------------------------------------------------------------
insert into canvass_leads (opco_id, territory_id, address, status, attempt_count, contacted_by, contacted_at, last_notes)
select
  (select id from organizations where slug = v.opco_slug),
  (select t.id from territories t
     where t.opco_id = (select id from organizations where slug = v.opco_slug)
       and t.name = v.territory_name
     limit 1),
  v.address,
  v.status,
  v.attempts,
  case when v.attempts > 0 then
    coalesce(
      (select p.id from profiles p
         where p.opco_id = (select id from organizations where slug = v.opco_slug)
         order by p.created_at asc limit 1),
      (select p.id from profiles p order by p.created_at asc limit 1)
    )
  else null end,
  case when v.attempts > 0
       then now() - (v.attempts * interval '1 day')
       else null end,
  case v.status
    when 'cold'                then null
    when 'knocked_no_answer'   then 'Nobody home; will retry.'
    when 'conversation'        then 'Brief chat — homeowner mentioned a leak last spring.'
    when 'interested'          then 'Wants to see pricing sheet; follow up Tuesday.'
    when 'appointment_booked'  then 'Enrollment appointment scheduled.'
    when 'signed'              then 'Enrolled on the Plus tier.'
    when 'rejected'            then 'Not a fit — just replaced roof.'
    when 'do_not_contact'      then 'Asked not to be contacted again.'
    else null
  end
from (values
  ('umbra-dfw', 'Downtown Dallas',       '1930 Commerce St, Dallas, TX 75201',          'cold',                0),
  ('umbra-dfw', 'Downtown Dallas',       '2015 Live Oak St, Dallas, TX 75201',          'knocked_no_answer',   1),
  ('umbra-dfw', 'Downtown Dallas',       '1604 Olive St, Dallas, TX 75201',             'conversation',        2),
  ('umbra-dfw', 'Downtown Dallas',       '2317 Bryan St, Dallas, TX 75201',             'interested',          2),
  ('umbra-dfw', 'North Dallas Corridor', '3120 Fairmount St, Dallas, TX 75204',         'appointment_booked',  3),
  ('umbra-dfw', 'North Dallas Corridor', '3415 Cole Ave, Dallas, TX 75204',             'signed',              3),
  ('umbra-dfw', 'Fort Worth West',       '3821 W 7th St, Fort Worth, TX 76107',         'cold',                0),
  ('umbra-dfw', 'Fort Worth West',       '4402 El Campo Ave, Fort Worth, TX 76107',     'knocked_no_answer',   2),
  ('umbra-dfw', 'Fort Worth West',       '5116 Birchman Ave, Fort Worth, TX 76107',     'conversation',        1),
  ('umbra-dfw', 'Fort Worth West',       '6208 Trail Lake Dr, Fort Worth, TX 76109',    'interested',          2),
  ('umbra-dfw', 'Fort Worth West',       '6734 Camp Bowie Blvd, Fort Worth, TX 76109',  'rejected',            1),
  ('umbra-dfw', 'Downtown Dallas',       '1017 Elm St, Dallas, TX 75202',               'cold',                0),
  ('umbra-phx', 'Central Phoenix',       '2117 N Central Ave, Phoenix, AZ 85004',       'cold',                0),
  ('umbra-phx', 'Central Phoenix',       '318 W McDowell Rd, Phoenix, AZ 85003',        'knocked_no_answer',   1),
  ('umbra-phx', 'Central Phoenix',       '725 W Roosevelt St, Phoenix, AZ 85003',       'conversation',        1),
  ('umbra-phx', 'Arcadia / Biltmore',    '4520 E Camelback Rd, Phoenix, AZ 85018',      'interested',          2),
  ('umbra-phx', 'Arcadia / Biltmore',    '5036 N 44th St, Phoenix, AZ 85018',           'appointment_booked',  2),
  ('umbra-phx', 'Arcadia / Biltmore',    '5618 E Lafayette Blvd, Phoenix, AZ 85018',    'signed',              3),
  ('umbra-phx', 'Downtown Phoenix',      '215 E Washington St, Phoenix, AZ 85004',      'cold',                0),
  ('umbra-phx', 'Downtown Phoenix',      '401 W Jefferson St, Phoenix, AZ 85003',       'do_not_contact',      1)
) as v(opco_slug, territory_name, address, status, attempts)
where (select id from organizations where slug = v.opco_slug) is not null
  and not exists (
    select 1 from canvass_leads cl
    where cl.opco_id = (select id from organizations where slug = v.opco_slug)
      and cl.address = v.address
  );

-- ---------------------------------------------------------------------
-- 6. Appointments
--    Only insert when the target member exists (so the script is safe
--    if some members were skipped). Idempotent on
--    (member_id, type, scheduled date).
-- ---------------------------------------------------------------------
insert into appointments (opco_id, member_id, type, scheduled_for, duration_minutes, assigned_to, booked_by, status, notes)
select
  (select id from organizations where slug = v.opco_slug),
  (select m.id from members m
     where m.opco_id = (select id from organizations where slug = v.opco_slug)
       and m.email = v.member_email
     limit 1),
  v.type,
  ((current_date + v.day_offset) + time '10:00'),
  60,
  coalesce(
    (select p.id from profiles p
       where p.opco_id = (select id from organizations where slug = v.opco_slug)
       order by p.created_at asc limit 1),
    (select p.id from profiles p order by p.created_at asc limit 1)
  ),
  coalesce(
    (select p.id from profiles p
       where p.opco_id = (select id from organizations where slug = v.opco_slug)
       order by p.created_at asc limit 1),
    (select p.id from profiles p order by p.created_at asc limit 1)
  ),
  v.status,
  null
from (values
  ('umbra-dfw', 'angela.harris@example.com',     'enrollment',   -14, 'completed'),
  ('umbra-dfw', 'marcus.bennett@example.com',    'inspection',    -7, 'completed'),
  ('umbra-dfw', 'priya.desai@example.com',       'consultation',   0, 'scheduled'),
  ('umbra-dfw', 'jonas.whitfield@example.com',   'follow_up',      1, 'scheduled'),
  ('umbra-dfw', 'sofia.ramirez@example.com',     'inspection',     3, 'confirmed'),
  ('umbra-dfw', 'trent.okafor@example.com',      'enrollment',     5, 'scheduled'),
  ('umbra-dfw', 'rachel.nguyen@example.com',     'follow_up',      7, 'scheduled'),
  ('umbra-dfw', 'hannah.kowalski@example.com',   'consultation',  -2, 'no_show'),
  ('umbra-phx', 'olivia.castellanos@example.com','inspection',    -5, 'completed'),
  ('umbra-phx', 'aisha.nasser@example.com',      'follow_up',      0, 'scheduled'),
  ('umbra-phx', 'carlos.mendoza@example.com',    'consultation',   2, 'scheduled'),
  ('umbra-phx', 'reza.khan@example.com',         'enrollment',     4, 'scheduled')
) as v(opco_slug, member_email, type, day_offset, status)
where exists (
  select 1 from members m
  where m.opco_id = (select id from organizations where slug = v.opco_slug)
    and m.email = v.member_email
)
and not exists (
  select 1 from appointments a
  join members m on m.id = a.member_id
  where m.email = v.member_email
    and a.type = v.type
    and a.scheduled_for::date = (current_date + v.day_offset)::date
);

-- ---------------------------------------------------------------------
-- 7. Activity log — back-fill so every seeded entity has at least one
--    historical event in the UI activity tabs. Idempotent on the
--    (entity_type, entity_id, action) triple.
-- ---------------------------------------------------------------------
insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  m.opco_id, m.created_by, 'member', m.id, 'member.created',
  jsonb_build_object('first_name', m.first_name, 'last_name', m.last_name, 'status', m.status)
from members m
where not exists (
  select 1 from activity_log al
  where al.entity_type = 'member' and al.entity_id = m.id and al.action = 'member.created'
);

insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  cl.opco_id, cl.contacted_by, 'lead', cl.id, 'lead.status_changed',
  jsonb_build_object('status', cl.status, 'attempt_count', cl.attempt_count)
from canvass_leads cl
where cl.contacted_by is not null
  and not exists (
    select 1 from activity_log al
    where al.entity_type = 'lead' and al.entity_id = cl.id and al.action = 'lead.status_changed'
  );

insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  a.opco_id, a.booked_by, 'appointment', a.id, 'appointment.scheduled',
  jsonb_build_object('type', a.type, 'scheduled_for', a.scheduled_for, 'status', a.status)
from appointments a
where not exists (
  select 1 from activity_log al
  where al.entity_type = 'appointment' and al.entity_id = a.id and al.action = 'appointment.scheduled'
);

-- ---------------------------------------------------------------------
-- 8. Verification — the Supabase SQL Editor will show this final
--    SELECT's result so you can confirm row counts. Expected after a
--    fresh run on the pilot DB: territories 6, members 15, properties
--    15, canvass_leads 20, appointments 12, plus matching activity_log
--    rows.
-- ---------------------------------------------------------------------
select 'organizations' as table_name, count(*) as rows from organizations
union all select 'profiles',      count(*) from profiles
union all select 'territories',   count(*) from territories
union all select 'members',       count(*) from members
union all select 'properties',    count(*) from properties
union all select 'canvass_leads', count(*) from canvass_leads
union all select 'appointments',  count(*) from appointments
union all select 'activity_log',  count(*) from activity_log
order by table_name;
