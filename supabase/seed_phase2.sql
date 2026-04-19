-- Phase 2 demo seed: realistic members, properties, territories, leads,
-- appointments, and activity_log entries for DFW and Phoenix. Safe to
-- re-run; all inserts use ON CONFLICT DO NOTHING or NOT EXISTS guards.
-- No hard-coded user ids — we look up the first profile in each OpCo and
-- fall back to the oldest available profile so dev environments without a
-- full user roster still seed without errors.

do $$
declare
  dfw_id uuid;
  phx_id uuid;
  dfw_user uuid;
  phx_user uuid;
  any_user uuid;
  m record;
  terr record;
  lead record;
  appt record;
begin
  select id into dfw_id from organizations where slug = 'umbra-dfw';
  select id into phx_id from organizations where slug = 'umbra-phx';

  if dfw_id is null or phx_id is null then
    raise notice 'Seed skipped: OpCos umbra-dfw/umbra-phx not found. Run supabase/seed.sql first.';
    return;
  end if;

  select id into any_user from profiles order by created_at asc limit 1;
  select id into dfw_user from profiles where opco_id = dfw_id order by created_at asc limit 1;
  select id into phx_user from profiles where opco_id = phx_id order by created_at asc limit 1;

  dfw_user := coalesce(dfw_user, any_user);
  phx_user := coalesce(phx_user, any_user);

  -- TERRITORIES -------------------------------------------------------
  insert into territories (opco_id, name, zip_codes, total_doors, active)
  select dfw_id, 'Downtown Dallas', array['75201','75202','75204'], 3200, true
  where not exists (select 1 from territories where opco_id = dfw_id and name = 'Downtown Dallas');

  insert into territories (opco_id, name, zip_codes, total_doors, active)
  select dfw_id, 'Fort Worth West', array['76107','76109'], 2800, true
  where not exists (select 1 from territories where opco_id = dfw_id and name = 'Fort Worth West');

  insert into territories (opco_id, name, zip_codes, total_doors, active)
  select dfw_id, 'North Dallas Corridor', array['75204'], 1900, true
  where not exists (select 1 from territories where opco_id = dfw_id and name = 'North Dallas Corridor');

  insert into territories (opco_id, name, zip_codes, total_doors, active)
  select phx_id, 'Central Phoenix', array['85003','85004'], 2400, true
  where not exists (select 1 from territories where opco_id = phx_id and name = 'Central Phoenix');

  insert into territories (opco_id, name, zip_codes, total_doors, active)
  select phx_id, 'Arcadia / Biltmore', array['85008','85018'], 2100, true
  where not exists (select 1 from territories where opco_id = phx_id and name = 'Arcadia / Biltmore');

  insert into territories (opco_id, name, zip_codes, total_doors, active)
  select phx_id, 'Downtown Phoenix', array['85001','85003'], 1600, true
  where not exists (select 1 from territories where opco_id = phx_id and name = 'Downtown Phoenix');

  -- MEMBERS + PROPERTIES ---------------------------------------------
  -- DFW: 10 members
  for m in
    select * from (values
      ('Angela','Harris','angela.harris@example.com','214-555-0114','member',     '1842 Oak Lawn Ave','Dallas','TX','75201','composition_shingle',18,2100,2),
      ('Marcus','Bennett','marcus.bennett@example.com','214-555-0128','member',   '2917 Swiss Ave','Dallas','TX','75204','composition_shingle',22,2600,2),
      ('Priya','Desai','priya.desai@example.com','214-555-0132','prospect',       '425 S Akard St','Dallas','TX','75202','composition_shingle',14,1900,2),
      ('Jonas','Whitfield','jonas.whitfield@example.com','214-555-0147','member', '3011 McKinney Ave','Dallas','TX','75204','standing_seam_metal',9,2400,2),
      ('Sofia','Ramirez','sofia.ramirez@example.com','214-555-0155','member',      '1515 Main St','Dallas','TX','75201','composition_shingle',20,2200,2),
      ('Trent','Okafor','trent.okafor@example.com','817-555-0163','prospect',      '3400 Camp Bowie Blvd','Fort Worth','TX','76107','composition_shingle',25,2000,1),
      ('Rachel','Nguyen','rachel.nguyen@example.com','817-555-0172','member',      '2812 W 7th St','Fort Worth','TX','76107','composition_shingle',12,2300,2),
      ('Devon','Alvarez','devon.alvarez@example.com','817-555-0185','paused',      '5015 Byers Ave','Fort Worth','TX','76107','composition_shingle',28,1850,1),
      ('Hannah','Kowalski','hannah.kowalski@example.com','817-555-0193','prospect','6401 Trail Lake Dr','Fort Worth','TX','76109','composition_shingle',16,2550,2),
      ('Eli','Brooks','eli.brooks@example.com','214-555-0208','member',            '2200 Ross Ave','Dallas','TX','75201','composition_shingle',21,2750,2)
    ) as x(first_name,last_name,email,phone,status,street,city,state,zip,roof_material,roof_age_years,square_footage,stories)
  loop
    perform 1 from members where opco_id = dfw_id and email = m.email;
    if not found then
      with new_member as (
        insert into members (opco_id, first_name, last_name, email, phone, source, status, preferred_contact, primary_cra_id, created_by)
        values (dfw_id, m.first_name, m.last_name, m.email, m.phone, 'canvass', m.status, 'email', dfw_user, dfw_user)
        returning id
      )
      insert into properties (member_id, opco_id, is_primary, street, city, state, zip, roof_material, roof_age_years, square_footage, stories)
      select id, dfw_id, true, m.street, m.city, m.state, m.zip, m.roof_material, m.roof_age_years, m.square_footage, m.stories
      from new_member;
    end if;
  end loop;

  -- Phoenix: 5 members
  for m in
    select * from (values
      ('Olivia','Castellanos','olivia.castellanos@example.com','602-555-0221','member', '1401 N Central Ave','Phoenix','AZ','85004','tile_concrete',18,2250,1),
      ('Marcus','Lee','marcus.lee@example.com','602-555-0238','prospect',                 '2700 N 3rd St','Phoenix','AZ','85004','tile_concrete',15,2100,1),
      ('Aisha','Nasser','aisha.nasser@example.com','602-555-0244','member',                '4602 E Indian School Rd','Phoenix','AZ','85018','tile_concrete',20,2700,1),
      ('Carlos','Mendoza','carlos.mendoza@example.com','602-555-0259','member',            '3812 E Camelback Rd','Phoenix','AZ','85018','standing_seam_metal',7,2400,2),
      ('Reza','Khan','reza.khan@example.com','602-555-0266','prospect',                    '901 W Washington St','Phoenix','AZ','85003','composition_shingle',19,1800,1)
    ) as x(first_name,last_name,email,phone,status,street,city,state,zip,roof_material,roof_age_years,square_footage,stories)
  loop
    perform 1 from members where opco_id = phx_id and email = m.email;
    if not found then
      with new_member as (
        insert into members (opco_id, first_name, last_name, email, phone, source, status, preferred_contact, primary_cra_id, created_by)
        values (phx_id, m.first_name, m.last_name, m.email, m.phone, 'canvass', m.status, 'email', phx_user, phx_user)
        returning id
      )
      insert into properties (member_id, opco_id, is_primary, street, city, state, zip, roof_material, roof_age_years, square_footage, stories)
      select id, phx_id, true, m.street, m.city, m.state, m.zip, m.roof_material, m.roof_age_years, m.square_footage, m.stories
      from new_member;
    end if;
  end loop;

  -- CANVASS LEADS ----------------------------------------------------
  for lead in
    select * from (values
      (dfw_id, 'Downtown Dallas',       '1930 Commerce St, Dallas, TX 75201',     'cold',                0),
      (dfw_id, 'Downtown Dallas',       '2015 Live Oak St, Dallas, TX 75201',     'knocked_no_answer',   1),
      (dfw_id, 'Downtown Dallas',       '1604 Olive St, Dallas, TX 75201',        'conversation',        2),
      (dfw_id, 'Downtown Dallas',       '2317 Bryan St, Dallas, TX 75201',        'interested',          2),
      (dfw_id, 'North Dallas Corridor', '3120 Fairmount St, Dallas, TX 75204',    'appointment_booked',  3),
      (dfw_id, 'North Dallas Corridor', '3415 Cole Ave, Dallas, TX 75204',        'signed',              3),
      (dfw_id, 'Fort Worth West',       '3821 W 7th St, Fort Worth, TX 76107',    'cold',                0),
      (dfw_id, 'Fort Worth West',       '4402 El Campo Ave, Fort Worth, TX 76107','knocked_no_answer',   2),
      (dfw_id, 'Fort Worth West',       '5116 Birchman Ave, Fort Worth, TX 76107','conversation',        1),
      (dfw_id, 'Fort Worth West',       '6208 Trail Lake Dr, Fort Worth, TX 76109','interested',         2),
      (dfw_id, 'Fort Worth West',       '6734 Camp Bowie Blvd, Fort Worth, TX 76109','rejected',         1),
      (dfw_id, 'Downtown Dallas',       '1017 Elm St, Dallas, TX 75202',          'cold',                0),
      (phx_id, 'Central Phoenix',       '2117 N Central Ave, Phoenix, AZ 85004',  'cold',                0),
      (phx_id, 'Central Phoenix',       '318 W McDowell Rd, Phoenix, AZ 85003',   'knocked_no_answer',   1),
      (phx_id, 'Central Phoenix',       '725 W Roosevelt St, Phoenix, AZ 85003',  'conversation',        1),
      (phx_id, 'Arcadia / Biltmore',    '4520 E Camelback Rd, Phoenix, AZ 85018', 'interested',          2),
      (phx_id, 'Arcadia / Biltmore',    '5036 N 44th St, Phoenix, AZ 85018',      'appointment_booked',  2),
      (phx_id, 'Arcadia / Biltmore',    '5618 E Lafayette Blvd, Phoenix, AZ 85018','signed',             3),
      (phx_id, 'Downtown Phoenix',      '215 E Washington St, Phoenix, AZ 85004', 'cold',                0),
      (phx_id, 'Downtown Phoenix',      '401 W Jefferson St, Phoenix, AZ 85003',  'do_not_contact',      1)
    ) as x(opco_id, territory_name, address, status, attempt_count)
  loop
    perform 1 from canvass_leads where opco_id = lead.opco_id and address = lead.address;
    if not found then
      insert into canvass_leads (opco_id, territory_id, address, status, attempt_count, contacted_by, contacted_at, last_notes)
      select lead.opco_id,
             (select id from territories where opco_id = lead.opco_id and name = lead.territory_name limit 1),
             lead.address,
             lead.status,
             lead.attempt_count,
             case when lead.attempt_count > 0 then coalesce(dfw_user, phx_user) else null end,
             case when lead.attempt_count > 0 then now() - (lead.attempt_count || ' days')::interval else null end,
             case lead.status
               when 'cold' then null
               when 'knocked_no_answer' then 'Nobody home; will retry.'
               when 'conversation' then 'Had brief chat — homeowner mentioned a leak last spring.'
               when 'interested' then 'Wants to see pricing sheet; follow up Tuesday.'
               when 'appointment_booked' then 'Enrollment appointment scheduled.'
               when 'signed' then 'Enrolled on the Plus tier.'
               when 'rejected' then 'Not a fit — just replaced roof.'
               when 'do_not_contact' then 'Asked not to be contacted again.'
               else null end;
    end if;
  end loop;

  -- APPOINTMENTS -----------------------------------------------------
  for appt in
    select * from (values
      (dfw_id, 'angela.harris@example.com',    'enrollment',  -14, 'completed'),
      (dfw_id, 'marcus.bennett@example.com',   'inspection',   -7, 'completed'),
      (dfw_id, 'priya.desai@example.com',      'consultation',  0, 'scheduled'),
      (dfw_id, 'jonas.whitfield@example.com',  'follow_up',     1, 'scheduled'),
      (dfw_id, 'sofia.ramirez@example.com',    'inspection',    3, 'confirmed'),
      (dfw_id, 'trent.okafor@example.com',     'enrollment',    5, 'scheduled'),
      (dfw_id, 'rachel.nguyen@example.com',    'follow_up',     7, 'scheduled'),
      (dfw_id, 'hannah.kowalski@example.com',  'consultation', -2, 'no_show'),
      (phx_id, 'olivia.castellanos@example.com','inspection',  -5, 'completed'),
      (phx_id, 'aisha.nasser@example.com',     'follow_up',     0, 'scheduled'),
      (phx_id, 'carlos.mendoza@example.com',   'consultation',  2, 'scheduled'),
      (phx_id, 'reza.khan@example.com',        'enrollment',    4, 'scheduled')
    ) as x(opco_id, member_email, type, day_offset, status)
  loop
    perform 1
    from appointments a
    join members me on me.id = a.member_id
    where a.opco_id = appt.opco_id
      and me.email = appt.member_email
      and a.type = appt.type
      and a.scheduled_for::date = (current_date + appt.day_offset)::date;
    if not found then
      insert into appointments (opco_id, member_id, type, scheduled_for, duration_minutes, assigned_to, booked_by, status, notes)
      select appt.opco_id,
             (select id from members where opco_id = appt.opco_id and email = appt.member_email limit 1),
             appt.type,
             (current_date + appt.day_offset + interval '10 hours'),
             60,
             case when appt.opco_id = dfw_id then dfw_user else phx_user end,
             case when appt.opco_id = dfw_id then dfw_user else phx_user end,
             appt.status,
             null;
    end if;
  end loop;

  -- ACTIVITY LOG (single-pass summary so the UI tabs have history) ---
  insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
  select opco_id, created_by, 'member', id, 'member.created',
         jsonb_build_object('first_name', first_name, 'last_name', last_name, 'status', status)
  from members
  where not exists (
    select 1 from activity_log al
    where al.entity_type = 'member' and al.entity_id = members.id and al.action = 'member.created'
  );

  insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
  select opco_id, contacted_by, 'lead', id, 'lead.status_changed',
         jsonb_build_object('status', status, 'attempt_count', attempt_count)
  from canvass_leads
  where contacted_by is not null
    and not exists (
      select 1 from activity_log al
      where al.entity_type = 'lead' and al.entity_id = canvass_leads.id and al.action = 'lead.status_changed'
    );

  insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
  select opco_id, booked_by, 'appointment', id, 'appointment.scheduled',
         jsonb_build_object('type', type, 'scheduled_for', scheduled_for, 'status', status)
  from appointments
  where not exists (
    select 1 from activity_log al
    where al.entity_type = 'appointment' and al.entity_id = appointments.id and al.action = 'appointment.scheduled'
  );
end $$;
