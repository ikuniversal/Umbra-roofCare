create extension if not exists "pgcrypto";

-- ORGANIZATIONS (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  type text not null check (type in ('holdco','opco')),
  state text,
  contractor_license_number text,
  phone text,
  email text,
  address jsonb,
  logo_url text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROFILES (extends auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  opco_id uuid references organizations(id),
  full_name text,
  email text,
  phone text,
  avatar_url text,
  active boolean default true,
  hired_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- USER ROLES (many-to-many)
create table user_roles (
  user_id uuid references profiles(id) on delete cascade,
  role text not null,
  opco_id uuid references organizations(id),
  granted_at timestamptz default now(),
  granted_by uuid references profiles(id),
  primary key (user_id, role, opco_id)
);

-- TEAMS
create table teams (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id) on delete cascade,
  name text not null,
  lead_user_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- MEMBERS (homeowners)
create table members (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  preferred_contact text check (preferred_contact in ('email','phone','sms')),
  source text check (source in ('canvass','referral','online','event','inbound','partner')),
  enrolled_at timestamptz,
  status text default 'prospect' check (status in ('prospect','member','paused','cancelled','churned')),
  lifecycle_stage text,
  notes text,
  tags text[],
  created_by uuid references profiles(id),
  primary_cra_id uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_members_opco on members(opco_id);
create index idx_members_status on members(opco_id, status);
create index idx_members_cra on members(primary_cra_id);

-- PROPERTIES
create table properties (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  opco_id uuid references organizations(id),
  is_primary boolean default true,
  street text not null,
  city text,
  state text,
  zip text,
  coordinates point,
  roof_material text,
  roof_age_years int,
  roof_installed_year int,
  square_footage int,
  stories int default 1,
  has_solar boolean default false,
  has_skylights boolean default false,
  has_chimney boolean default false,
  pitch text,
  last_score int,
  last_inspection_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_properties_member on properties(member_id);
create index idx_properties_opco on properties(opco_id);

-- TERRITORIES
create table territories (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  name text not null,
  boundary jsonb,
  assigned_team_id uuid references teams(id),
  total_doors int,
  active boolean default true,
  created_at timestamptz default now()
);

-- CANVASS LEADS
create table canvass_leads (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  territory_id uuid references territories(id),
  address text not null,
  coordinates point,
  status text default 'cold' check (status in ('cold','knocked_no_answer','conversation','interested','appointment_booked','signed','rejected','do_not_contact')),
  contacted_by uuid references profiles(id),
  contacted_at timestamptz,
  last_notes text,
  attempt_count int default 0,
  converted_to_member_id uuid references members(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_leads_opco_status on canvass_leads(opco_id, status);
create index idx_leads_setter on canvass_leads(contacted_by);

-- APPOINTMENTS
create table appointments (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  member_id uuid references members(id),
  lead_id uuid references canvass_leads(id),
  type text not null check (type in ('enrollment','inspection','consultation','service_quote','follow_up')),
  scheduled_for timestamptz not null,
  duration_minutes int default 60,
  assigned_to uuid references profiles(id),
  status text default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show','rescheduled')),
  notes text,
  booked_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index idx_appt_assigned on appointments(assigned_to, scheduled_for);
create index idx_appt_opco on appointments(opco_id, scheduled_for);

-- SUBSCRIPTIONS
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  member_id uuid references members(id) on delete cascade,
  tier text not null check (tier in ('essentials','plus','premium')),
  status text default 'active' check (status in ('trialing','active','past_due','cancelled','paused')),
  started_at timestamptz default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  cancel_at_period_end boolean default false,
  price_cents int not null,
  billing_interval text check (billing_interval in ('monthly','annual')),
  stripe_subscription_id text,
  stripe_customer_id text,
  sold_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index idx_subs_member on subscriptions(member_id);
create index idx_subs_status on subscriptions(opco_id, status);

-- PAYMENTS
create table payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id),
  member_id uuid references members(id),
  amount_cents int not null,
  status text check (status in ('pending','succeeded','failed','refunded')),
  charged_at timestamptz,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  failure_reason text,
  created_at timestamptz default now()
);

-- INSPECTIONS
create table inspections (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  property_id uuid references properties(id),
  member_id uuid references members(id),
  appointment_id uuid references appointments(id),
  inspector_id uuid references profiles(id),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  overall_score int check (overall_score between 0 and 100),
  condition_band text check (condition_band in ('healthy','moderate','high_risk','critical')),
  recommended_action text check (recommended_action in ('maintain','repair','rejuvenate','replace_plan')),
  score_breakdown jsonb,
  photos_manifest jsonb,
  report_pdf_url text,
  weather_at_inspection text,
  duration_minutes int,
  notes text,
  status text default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled','needs_review')),
  created_at timestamptz default now()
);

create index idx_insp_member on inspections(member_id);
create index idx_insp_inspector on inspections(inspector_id);
create index idx_insp_status on inspections(opco_id, status);

-- INSPECTION FINDINGS
create table inspection_findings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references inspections(id) on delete cascade,
  category text not null,
  severity text check (severity in ('info','minor','moderate','severe','critical')),
  description text not null,
  location text,
  photo_urls text[],
  estimated_repair_cents int,
  created_at timestamptz default now()
);

-- OPPORTUNITIES
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  member_id uuid references members(id),
  inspection_id uuid references inspections(id),
  type text check (type in ('repair','rejuvenation','replacement_plan','warranty_claim')),
  status text default 'open' check (status in ('open','contacted','quoted','won','lost','on_hold')),
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  estimated_value_cents int,
  assigned_specialist_id uuid references profiles(id),
  notes text,
  won_job_id uuid,
  lost_reason text,
  opened_at timestamptz default now(),
  contacted_at timestamptz,
  quoted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_opp_specialist on opportunities(assigned_specialist_id);
create index idx_opp_status on opportunities(opco_id, status);

-- JOBS
create table jobs (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  member_id uuid references members(id),
  property_id uuid references properties(id),
  opportunity_id uuid references opportunities(id),
  type text check (type in ('repair','rejuvenation','replacement','warranty','subscription_maintenance')),
  status text default 'quoted' check (status in ('quoted','accepted','scheduled','in_progress','completed','cancelled','on_hold')),
  quoted_cents int,
  final_cents int,
  quoted_at timestamptz,
  accepted_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  specialist_id uuid references profiles(id),
  crew_id uuid,
  project_manager_id uuid references profiles(id),
  job_number text unique,
  warranty_years int,
  financing_type text,
  notes text,
  created_at timestamptz default now()
);

create index idx_jobs_member on jobs(member_id);
create index idx_jobs_status on jobs(opco_id, status);
create index idx_jobs_crew on jobs(crew_id);

create table job_line_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit_price_cents int,
  total_cents int,
  sort_order int default 0
);

-- CREWS
create table crews (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  name text,
  type text check (type in ('inspection','maintenance','repair','replacement')),
  lead_id uuid references profiles(id),
  active boolean default true,
  created_at timestamptz default now()
);

create table crew_assignments (
  crew_id uuid references crews(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text,
  primary key (crew_id, user_id)
);

-- COMMISSIONS
create table commissions (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  user_id uuid references profiles(id),
  event_type text check (event_type in ('signup','residual','repair_sale','replacement_sale','rejuvenation_sale','override_team','override_area','clawback')),
  source_type text,
  source_id uuid,
  amount_cents int not null,
  calculated_at timestamptz default now(),
  pay_period_id uuid,
  paid_at timestamptz,
  notes text,
  reversed boolean default false,
  created_at timestamptz default now()
);

create index idx_comm_user on commissions(user_id, calculated_at desc);
create index idx_comm_period on commissions(pay_period_id);

create table pay_periods (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  period_start date,
  period_end date,
  status text default 'open' check (status in ('open','processing','paid')),
  paid_at timestamptz
);

-- COMMUNICATIONS
create table comm_templates (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  name text not null,
  channel text check (channel in ('email','sms')),
  subject text,
  body text not null,
  variables text[],
  trigger_event text,
  active boolean default true,
  created_at timestamptz default now()
);

create table comm_messages (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  member_id uuid references members(id),
  user_id uuid references profiles(id),
  template_id uuid references comm_templates(id),
  channel text check (channel in ('email','sms')),
  subject text,
  body text,
  to_address text,
  sent_at timestamptz,
  status text check (status in ('queued','sent','failed','bounced','opened','clicked')),
  external_id text,
  error text,
  created_at timestamptz default now()
);

create index idx_msg_member on comm_messages(member_id, created_at desc);

-- NOTES
create table notes (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  entity_type text not null,
  entity_id uuid not null,
  body text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index idx_notes_entity on notes(entity_type, entity_id);

-- ACTIVITY LOG
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  opco_id uuid references organizations(id),
  user_id uuid references profiles(id),
  entity_type text,
  entity_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

create index idx_activity_entity on activity_log(entity_type, entity_id, created_at desc);
create index idx_activity_user on activity_log(user_id, created_at desc);

-- AUTO-PROFILE TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS HELPERS
-- SECURITY DEFINER so these helpers bypass RLS on the tables they read.
-- Without it, the helpers re-enter the same RLS policies that invoke them,
-- and the nested policy evaluation prevents rows from being returned —
-- users end up appearing as if they have no opco and no roles.
create or replace function public.current_opco_id()
returns uuid language sql stable security definer set search_path = public as $$
  select opco_id from profiles where id = auth.uid() limit 1;
$$;

create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('super_admin','executive','corp_dev')
  );
$$;

-- ENABLE RLS on every tenant table
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table members enable row level security;
alter table properties enable row level security;
alter table territories enable row level security;
alter table canvass_leads enable row level security;
alter table appointments enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table inspections enable row level security;
alter table inspection_findings enable row level security;
alter table opportunities enable row level security;
alter table jobs enable row level security;
alter table job_line_items enable row level security;
alter table crews enable row level security;
alter table crew_assignments enable row level security;
alter table commissions enable row level security;
alter table pay_periods enable row level security;
alter table comm_templates enable row level security;
alter table comm_messages enable row level security;
alter table notes enable row level security;
alter table activity_log enable row level security;

-- RLS policy patterns
-- Organizations: super_admin sees all, others see their own
create policy "orgs_select" on organizations for select using (id = current_opco_id() or is_super_admin());
create policy "orgs_all" on organizations for all using (is_super_admin()) with check (is_super_admin());

-- Profiles: authenticated see all profiles in their opco, update only own
create policy "profiles_select" on profiles for select using (opco_id = current_opco_id() or is_super_admin() or id = auth.uid());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());
create policy "profiles_super_admin_all" on profiles for all using (is_super_admin()) with check (is_super_admin());

-- User Roles: read within opco, super_admin writes
create policy "roles_select" on user_roles for select using (opco_id = current_opco_id() or is_super_admin() or user_id = auth.uid());
create policy "roles_super_admin_all" on user_roles for all using (is_super_admin()) with check (is_super_admin());

-- Standard tenant pattern applied to every remaining tenant table
-- (teams, team_members, members, properties, territories, canvass_leads, appointments,
--  subscriptions, payments, inspections, inspection_findings, opportunities, jobs,
--  job_line_items, crews, crew_assignments, commissions, pay_periods, comm_templates,
--  comm_messages, notes, activity_log)
-- For each: select/insert/update restricted to same opco OR super_admin; delete restricted to super_admin.

-- Apply tenant pattern to each table:
create policy "teams_tenant" on teams for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "team_members_tenant" on team_members for all using (exists (select 1 from teams where teams.id = team_members.team_id and (teams.opco_id = current_opco_id() or is_super_admin()))) with check (exists (select 1 from teams where teams.id = team_members.team_id and (teams.opco_id = current_opco_id() or is_super_admin())));
create policy "members_tenant" on members for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "properties_tenant" on properties for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "territories_tenant" on territories for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "canvass_leads_tenant" on canvass_leads for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "appointments_tenant" on appointments for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "subscriptions_tenant" on subscriptions for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "payments_tenant" on payments for all using (exists (select 1 from subscriptions s where s.id = payments.subscription_id and (s.opco_id = current_opco_id() or is_super_admin()))) with check (exists (select 1 from subscriptions s where s.id = payments.subscription_id and (s.opco_id = current_opco_id() or is_super_admin())));
create policy "inspections_tenant" on inspections for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "inspection_findings_tenant" on inspection_findings for all using (exists (select 1 from inspections i where i.id = inspection_findings.inspection_id and (i.opco_id = current_opco_id() or is_super_admin()))) with check (exists (select 1 from inspections i where i.id = inspection_findings.inspection_id and (i.opco_id = current_opco_id() or is_super_admin())));
create policy "opportunities_tenant" on opportunities for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "jobs_tenant" on jobs for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "job_line_items_tenant" on job_line_items for all using (exists (select 1 from jobs j where j.id = job_line_items.job_id and (j.opco_id = current_opco_id() or is_super_admin()))) with check (exists (select 1 from jobs j where j.id = job_line_items.job_id and (j.opco_id = current_opco_id() or is_super_admin())));
create policy "crews_tenant" on crews for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "crew_assignments_tenant" on crew_assignments for all using (exists (select 1 from crews c where c.id = crew_assignments.crew_id and (c.opco_id = current_opco_id() or is_super_admin()))) with check (exists (select 1 from crews c where c.id = crew_assignments.crew_id and (c.opco_id = current_opco_id() or is_super_admin())));
create policy "commissions_tenant" on commissions for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "pay_periods_tenant" on pay_periods for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "comm_templates_tenant" on comm_templates for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "comm_messages_tenant" on comm_messages for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "notes_tenant" on notes for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
create policy "activity_log_tenant" on activity_log for all using (opco_id = current_opco_id() or is_super_admin()) with check (opco_id = current_opco_id() or is_super_admin());
