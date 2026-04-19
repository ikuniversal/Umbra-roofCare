-- Phase 3 seed: default inspection template + decision engine rules +
-- 6 completed inspections spread across the Phase 2 member roster.
--
-- Safe to re-run; uses idempotent patterns anchored on template names,
-- rule names, and inspection (member_id, template_id) pairs.

-- ---------------------------------------------------------------
-- 1. Default 20-point template (opco_id null = global default).
-- ---------------------------------------------------------------
insert into inspection_templates (opco_id, name, version, active, checkpoints)
select
  null,
  'Umbra Standard 20-Point',
  1,
  true,
  jsonb_build_array(
    jsonb_build_object('id','surface_shingle_integrity','label','Shingle integrity','category','Roof Surface','weight',6,'order',1),
    jsonb_build_object('id','surface_granule_loss','label','Granule loss / aging','category','Roof Surface','weight',5,'order',2),
    jsonb_build_object('id','surface_algae_moss','label','Algae / moss / debris','category','Roof Surface','weight',4,'order',3),
    jsonb_build_object('id','surface_visible_damage','label','Visible damage (hail, impact, lift)','category','Roof Surface','weight',6,'order',4),
    jsonb_build_object('id','surface_ridge_hip','label','Ridge and hip condition','category','Roof Surface','weight',4,'order',5),
    jsonb_build_object('id','flashing_plumbing_vents','label','Plumbing vents seal','category','Penetrations & Flashing','weight',5,'order',6),
    jsonb_build_object('id','flashing_chimney','label','Chimney flashing','category','Penetrations & Flashing','weight',5,'order',7),
    jsonb_build_object('id','flashing_skylight','label','Skylight seals','category','Penetrations & Flashing','weight',5,'order',8),
    jsonb_build_object('id','flashing_step_wall','label','Step flashing at walls','category','Penetrations & Flashing','weight',5,'order',9),
    jsonb_build_object('id','flashing_valley','label','Valley condition','category','Penetrations & Flashing','weight',5,'order',10),
    jsonb_build_object('id','drainage_gutters','label','Gutters (debris, sag, detachment)','category','Drainage','weight',5,'order',11),
    jsonb_build_object('id','drainage_downspouts','label','Downspouts','category','Drainage','weight',5,'order',12),
    jsonb_build_object('id','drainage_drip_edge','label','Drip edge installation','category','Drainage','weight',5,'order',13),
    jsonb_build_object('id','structural_deck_sag','label','Roof deck sag / unevenness','category','Structural','weight',6,'order',14),
    jsonb_build_object('id','structural_fascia_soffit','label','Fascia and soffit condition','category','Structural','weight',5,'order',15),
    jsonb_build_object('id','structural_attic_vent','label','Attic ventilation','category','Structural','weight',4,'order',16),
    jsonb_build_object('id','interior_water_staining','label','Water staining on deck underside','category','Attic / Interior Signs','weight',5,'order',17),
    jsonb_build_object('id','interior_daylight','label','Daylight through roof','category','Attic / Interior Signs','weight',5,'order',18),
    jsonb_build_object('id','environment_roof_age','label','Overall roof age vs. material lifespan','category','Environmental / Aging','weight',5,'order',19),
    jsonb_build_object('id','environment_tree_overhang','label','Tree overhang / surrounding risks','category','Environmental / Aging','weight',5,'order',20)
  )
where not exists (
  select 1 from inspection_templates
  where opco_id is null and name = 'Umbra Standard 20-Point' and version = 1
);

-- ---------------------------------------------------------------
-- 2. Default decision engine rules (opco_id null).
-- ---------------------------------------------------------------
with defaults (name, description, priority, conditions, actions) as (
  values
    (
      'Critical roof → urgent replacement plan',
      'Score 0-39 always triggers a replacement plan opportunity, urgent priority.',
      10,
      jsonb_build_object('score_lte', 39),
      jsonb_build_object(
        'create_opportunity', jsonb_build_object(
          'type', 'replacement_plan',
          'priority', 'urgent',
          'notes_template', 'Critical roof condition (score {{score}}). Recommend full replacement plan consult.'
        )
      )
    ),
    (
      'High risk with severe findings → repair + replacement plan',
      'Score 40-59 with at least one severe finding opens both a repair and a replacement plan opportunity.',
      20,
      jsonb_build_object(
        'score_between', jsonb_build_array(40, 59),
        'has_finding_severity', jsonb_build_array('severe','critical')
      ),
      jsonb_build_object(
        'create_opportunity', jsonb_build_object(
          'type', 'repair',
          'priority', 'high',
          'notes_template', 'High-risk roof (score {{score}}) with severe findings. Repair + replacement plan consult opened.'
        ),
        'create_opportunity_secondary', jsonb_build_object(
          'type', 'replacement_plan',
          'priority', 'high',
          'notes_template', 'Paired replacement plan consult for high-risk roof (score {{score}}).'
        )
      )
    ),
    (
      'Moderate roof with specific repair findings → repair opportunity',
      'Score 60-79 with moderate+ finding opens a repair opportunity.',
      30,
      jsonb_build_object(
        'score_between', jsonb_build_array(60, 79),
        'has_finding_severity', jsonb_build_array('moderate','severe','critical')
      ),
      jsonb_build_object(
        'create_opportunity', jsonb_build_object(
          'type', 'repair',
          'priority', 'normal',
          'notes_template', 'Moderate condition (score {{score}}). Specific findings identified for repair.'
        )
      )
    ),
    (
      'Moderate roof with uniform aging → rejuvenation opportunity',
      'Score 60-79, nothing above minor, roof age ≥ 12 — classic rejuvenation candidate.',
      40,
      jsonb_build_object(
        'score_between', jsonb_build_array(60, 79),
        'no_finding_severity_above', 'minor',
        'roof_age_gte', 12
      ),
      jsonb_build_object(
        'create_opportunity', jsonb_build_object(
          'type', 'rejuvenation',
          'priority', 'normal',
          'notes_template', 'Uniform aging on a {{roof_age}}-year roof (score {{score}}). Rejuvenation candidate.'
        )
      )
    ),
    (
      'Active leak detected → urgent repair',
      'Water staining finding of moderate+ severity opens an urgent repair regardless of score.',
      5,
      jsonb_build_object(
        'has_finding_category', 'water_staining',
        'severity_gte', 'moderate'
      ),
      jsonb_build_object(
        'create_opportunity', jsonb_build_object(
          'type', 'repair',
          'priority', 'urgent',
          'notes_template', 'Active or recent leak indicators found. Urgent repair triage required.'
        )
      )
    ),
    (
      'Healthy roof → maintenance log only',
      'Score 80+ is recorded as healthy; no opportunity opened.',
      99,
      jsonb_build_object('score_gte', 80),
      jsonb_build_object('log_only', true)
    )
)
insert into decision_engine_rules (opco_id, name, description, priority, active, conditions, actions)
select null, d.name, d.description, d.priority, true, d.conditions, d.actions
from defaults d
where not exists (
  select 1 from decision_engine_rules r
  where r.opco_id is null and r.name = d.name
);

-- ---------------------------------------------------------------
-- 3. Backfill 6 completed inspections, balanced across condition bands.
-- ---------------------------------------------------------------
create temporary table _phase3_demo_inspections on commit drop as
with template as (
  select id as template_id, version
  from inspection_templates
  where opco_id is null and name = 'Umbra Standard 20-Point'
  limit 1
),
m as (
  select
    m.id as member_id,
    m.opco_id,
    p.id as property_id,
    p.roof_age_years,
    row_number() over (order by m.created_at asc) as rn
  from members m
  join properties p on p.member_id = m.id and p.is_primary
),
demo (rn, score, band, action, age_override) as (
  values
    (1::int, 92::int, 'healthy'::text, 'maintain'::text, null::int),
    (2::int, 74::int, 'moderate'::text, 'repair'::text, null::int),
    (3::int, 68::int, 'moderate'::text, 'rejuvenate'::text, 16::int),
    (4::int, 52::int, 'high_risk'::text, 'repair'::text, null::int),
    (5::int, 44::int, 'high_risk'::text, 'repair'::text, null::int),
    (6::int, 28::int, 'critical'::text, 'replace_plan'::text, null::int)
)
select
  m.member_id,
  m.opco_id,
  m.property_id,
  coalesce(demo.age_override, m.roof_age_years) as roof_age_years,
  demo.score,
  demo.band,
  demo.action,
  t.template_id,
  t.version
from template t, m
join demo on demo.rn = m.rn;

-- Insert the inspections (idempotent: one per member + template).
insert into inspections (
  opco_id,
  property_id,
  member_id,
  template_id,
  template_version,
  scheduled_for,
  started_at,
  completed_at,
  overall_score,
  condition_band,
  recommended_action,
  score_breakdown,
  status,
  notes,
  weather_at_inspection,
  duration_minutes,
  checkpoint_results
)
select
  d.opco_id,
  d.property_id,
  d.member_id,
  d.template_id,
  d.version,
  now() - interval '8 days',
  now() - interval '8 days' + interval '15 minutes',
  now() - interval '8 days' + interval '55 minutes',
  d.score,
  d.band,
  d.action,
  jsonb_build_object(
    'Roof Surface',             round(d.score * 0.25),
    'Penetrations & Flashing',  round(d.score * 0.25),
    'Drainage',                 round(d.score * 0.15),
    'Structural',               round(d.score * 0.15),
    'Attic / Interior Signs',   round(d.score * 0.10),
    'Environmental / Aging',    round(d.score * 0.10)
  ),
  'completed',
  'Seeded demo inspection — see Phase 3 seed_phase3.sql.',
  'Clear, 72°F',
  40,
  jsonb_build_array(
    jsonb_build_object(
      'checkpoint_id','surface_shingle_integrity',
      'rating', case when d.score >= 80 then 'pass' when d.score >= 50 then 'warn' else 'fail' end,
      'notes', null,
      'photo_urls', jsonb_build_array('https://placehold.co/800x600/1F2937/FAF7F0?text=Shingle')
    ),
    jsonb_build_object(
      'checkpoint_id','surface_granule_loss',
      'rating', case when d.score >= 80 then 'pass' when d.score >= 40 then 'warn' else 'fail' end,
      'notes', 'Granule wash at downspouts.',
      'photo_urls', jsonb_build_array()
    ),
    jsonb_build_object(
      'checkpoint_id','flashing_chimney',
      'rating', case when d.score >= 70 then 'pass' when d.score >= 40 then 'warn' else 'fail' end,
      'notes', null,
      'photo_urls', jsonb_build_array()
    ),
    jsonb_build_object(
      'checkpoint_id','interior_water_staining',
      'rating', case when d.score < 55 then 'fail' when d.score < 75 then 'warn' else 'pass' end,
      'notes', null,
      'photo_urls', jsonb_build_array()
    )
  )
from _phase3_demo_inspections d
where not exists (
  select 1 from inspections i
  where i.member_id = d.member_id
    and i.template_id = d.template_id
    and i.notes = 'Seeded demo inspection — see Phase 3 seed_phase3.sql.'
);

-- Findings: 3-6 per inspection, varied severity driven by band.
insert into inspection_findings (
  inspection_id, category, severity, description, location, photo_urls, estimated_repair_cents
)
select
  i.id,
  f.category,
  f.severity,
  f.description,
  f.location,
  f.photos,
  f.cents
from inspections i
join _phase3_demo_inspections d on d.member_id = i.member_id and d.template_id = i.template_id
cross join lateral (
  select * from (values
    ('shingle', 'moderate', 'Granule loss concentrated on south slope.', 'South slope',
     array['https://placehold.co/800x600/D97706/FAF7F0?text=Granule+Loss'], 95000),
    ('flashing', 'minor', 'Chimney flashing sealant cracking.', 'Chimney',
     array['https://placehold.co/800x600/6B6358/FAF7F0?text=Chimney+Flashing'], 28000),
    ('drainage', 'minor', 'Gutters partially full of debris.', 'Front + side',
     array['https://placehold.co/800x600/3A6E42/FAF7F0?text=Gutters'], 35000),
    ('water_staining', 'severe', 'Brown rings on deck underside above master bedroom.', 'Attic, bedroom corner',
     array['https://placehold.co/800x600/9B2C2C/FAF7F0?text=Water+Stain'], 160000),
    ('structural', 'critical', 'Visible deck sag along the rear valley.', 'Rear valley',
     array['https://placehold.co/800x600/1F2937/FAF7F0?text=Deck+Sag'], 420000),
    ('surface', 'info', 'Overall age consistent with 15-year composition shingle.', 'General',
     array[]::text[], 0)
  ) as t(category, severity, description, location, photos, cents)
  where
    case d.band
      when 'healthy' then t.severity in ('info','minor')
      when 'moderate' then t.severity in ('info','minor','moderate')
      when 'high_risk' then t.severity in ('minor','moderate','severe')
      when 'critical' then t.severity in ('moderate','severe','critical')
      else true
    end
) f
where not exists (
  select 1 from inspection_findings ff
  where ff.inspection_id = i.id and ff.description = f.description
);

-- ---------------------------------------------------------------
-- 4. Decision Engine replay against the seeded inspections.
-- ---------------------------------------------------------------
-- Run the same rule priority / first-match logic the app uses, so the
-- seeded opportunities look like they were created by the engine.

-- Helper: first matching rule id for a given inspection.
create temporary table _phase3_matched_rules on commit drop as
with i as (
  select
    i.id as inspection_id,
    i.overall_score,
    i.opco_id,
    i.member_id,
    d.roof_age_years
  from inspections i
  join _phase3_demo_inspections d
    on d.member_id = i.member_id and d.template_id = i.template_id
),
findings as (
  select
    f.inspection_id,
    array_agg(distinct f.severity) as severities,
    array_agg(distinct f.category) as categories,
    max(case f.severity
      when 'critical' then 5
      when 'severe' then 4
      when 'moderate' then 3
      when 'minor' then 2
      when 'info' then 1
    end) as max_sev_rank
  from inspection_findings f
  group by f.inspection_id
),
rules as (
  select r.*, (r.conditions->>'score_lte')::int as score_lte,
         (r.conditions->>'score_gte')::int as score_gte,
         (r.conditions->'score_between'->>0)::int as score_between_lo,
         (r.conditions->'score_between'->>1)::int as score_between_hi,
         r.conditions->'has_finding_severity' as has_finding_severity,
         r.conditions->>'has_finding_category' as has_finding_category,
         r.conditions->>'severity_gte' as severity_gte,
         r.conditions->>'no_finding_severity_above' as no_finding_severity_above,
         (r.conditions->>'roof_age_gte')::int as roof_age_gte
  from decision_engine_rules r
  where r.opco_id is null and r.active
),
candidates as (
  select
    i.inspection_id,
    r.*,
    row_number() over (
      partition by i.inspection_id
      order by r.priority asc
    ) as rank
  from i
  left join findings f on f.inspection_id = i.inspection_id
  join rules r on (
    (r.score_lte is null or i.overall_score <= r.score_lte) and
    (r.score_gte is null or i.overall_score >= r.score_gte) and
    (r.score_between_lo is null or (i.overall_score between r.score_between_lo and r.score_between_hi)) and
    (r.has_finding_severity is null or exists (
      select 1 from jsonb_array_elements_text(r.has_finding_severity) sev
      where sev.value = any(coalesce(f.severities, array[]::text[]))
    )) and
    (r.has_finding_category is null or r.has_finding_category = any(coalesce(f.categories, array[]::text[]))) and
    (r.severity_gte is null or (
      f.max_sev_rank is not null and f.max_sev_rank >=
        (case r.severity_gte
          when 'critical' then 5 when 'severe' then 4
          when 'moderate' then 3 when 'minor' then 2 when 'info' then 1
        end)
    )) and
    (r.no_finding_severity_above is null or (
      coalesce(f.max_sev_rank, 0) <=
        (case r.no_finding_severity_above
          when 'critical' then 5 when 'severe' then 4
          when 'moderate' then 3 when 'minor' then 2 when 'info' then 1
          else 0
        end)
    )) and
    (r.roof_age_gte is null or (i.roof_age_years is not null and i.roof_age_years >= r.roof_age_gte))
  )
)
select inspection_id, id as rule_id, name, actions, (
  select overall_score from inspections where id = c.inspection_id
) as score,
  (select roof_age_years from _phase3_demo_inspections d where d.member_id = (select member_id from inspections where id = c.inspection_id) limit 1) as roof_age
from candidates c
where rank = 1;

-- Create the primary opportunity if the rule has one.
insert into opportunities (
  opco_id, member_id, inspection_id, type, status, priority, notes, opened_at
)
select
  i.opco_id,
  i.member_id,
  i.id,
  m.actions->'create_opportunity'->>'type',
  'open',
  m.actions->'create_opportunity'->>'priority',
  replace(
    replace(
      m.actions->'create_opportunity'->>'notes_template',
      '{{score}}',
      i.overall_score::text
    ),
    '{{roof_age}}',
    coalesce(m.roof_age::text, '?')
  ),
  i.completed_at
from _phase3_matched_rules m
join inspections i on i.id = m.inspection_id
where m.actions ? 'create_opportunity'
  and not exists (
    select 1 from opportunities o
    where o.inspection_id = i.id
      and o.type = m.actions->'create_opportunity'->>'type'
  );

-- And the secondary opportunity (used by "high risk with severe findings").
insert into opportunities (
  opco_id, member_id, inspection_id, type, status, priority, notes, opened_at
)
select
  i.opco_id,
  i.member_id,
  i.id,
  m.actions->'create_opportunity_secondary'->>'type',
  'open',
  m.actions->'create_opportunity_secondary'->>'priority',
  replace(
    replace(
      m.actions->'create_opportunity_secondary'->>'notes_template',
      '{{score}}',
      i.overall_score::text
    ),
    '{{roof_age}}',
    coalesce(m.roof_age::text, '?')
  ),
  i.completed_at
from _phase3_matched_rules m
join inspections i on i.id = m.inspection_id
where m.actions ? 'create_opportunity_secondary'
  and not exists (
    select 1 from opportunities o
    where o.inspection_id = i.id
      and o.type = m.actions->'create_opportunity_secondary'->>'type'
  );

-- Link the property's last_score / last_inspection_at for UX freshness.
update properties p
set last_score = i.overall_score,
    last_inspection_at = i.completed_at
from inspections i
where i.property_id = p.id
  and i.notes = 'Seeded demo inspection — see Phase 3 seed_phase3.sql.'
  and (p.last_inspection_at is null or p.last_inspection_at < i.completed_at);

-- Activity-log the decision engine runs.
insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  i.opco_id,
  null,
  'inspection',
  i.id,
  'decision_engine.rule_matched',
  jsonb_build_object('rule_name', m.name, 'score', i.overall_score)
from _phase3_matched_rules m
join inspections i on i.id = m.inspection_id
where not exists (
  select 1 from activity_log a
  where a.entity_id = i.id
    and a.action = 'decision_engine.rule_matched'
);

insert into activity_log (opco_id, user_id, entity_type, entity_id, action, detail)
select
  i.opco_id,
  null,
  'inspection',
  i.id,
  'inspection.completed',
  jsonb_build_object('score', i.overall_score, 'band', i.condition_band)
from inspections i
where i.notes = 'Seeded demo inspection — see Phase 3 seed_phase3.sql.'
  and not exists (
    select 1 from activity_log a
    where a.entity_id = i.id
      and a.action = 'inspection.completed'
  );
