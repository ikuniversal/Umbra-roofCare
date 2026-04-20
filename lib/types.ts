export type OrgType = "holdco" | "opco";

export type Role =
  | "super_admin"
  | "executive"
  | "corp_dev"
  | "opco_gm"
  | "sales_manager"
  | "area_manager"
  | "team_lead"
  | "cra"
  | "setter"
  | "inspector"
  | "specialist"
  | "csm"
  | "crew_member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  state: string | null;
  contractor_license_number: string | null;
  phone: string | null;
  email: string | null;
  address: Record<string, unknown> | null;
  logo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  opco_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  hired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role: Role;
  opco_id: string | null;
  granted_at: string;
  granted_by: string | null;
}

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
  roles: Role[];
  opcoId: string | null;
  organization: Organization | null;
}

// --- Phase 2: Member Lifecycle ---------------------------------------

export type MemberStatus =
  | "prospect"
  | "member"
  | "paused"
  | "cancelled"
  | "churned";

export type ContactChannel = "email" | "phone" | "sms";

export type MemberSource =
  | "canvass"
  | "referral"
  | "online"
  | "event"
  | "inbound"
  | "partner";

export interface Member {
  id: string;
  opco_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  preferred_contact: ContactChannel | null;
  source: MemberSource | null;
  enrolled_at: string | null;
  status: MemberStatus;
  lifecycle_stage: string | null;
  notes: string | null;
  tags: string[] | null;
  created_by: string | null;
  primary_cra_id: string | null;
  created_at: string;
  updated_at: string;
}

export type RoofMaterial =
  | "composition_shingle"
  | "standing_seam_metal"
  | "tile_concrete"
  | "tile_clay"
  | "slate"
  | "wood_shake"
  | "flat_membrane"
  | "other";

export interface Property {
  id: string;
  member_id: string | null;
  opco_id: string | null;
  is_primary: boolean;
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  roof_material: RoofMaterial | null;
  roof_age_years: number | null;
  roof_installed_year: number | null;
  square_footage: number | null;
  stories: number | null;
  has_solar: boolean;
  has_skylights: boolean;
  has_chimney: boolean;
  pitch: string | null;
  last_score: number | null;
  last_inspection_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Territory {
  id: string;
  opco_id: string | null;
  name: string;
  boundary: unknown | null;
  assigned_team_id: string | null;
  total_doors: number | null;
  active: boolean;
  created_at: string;
  zip_codes: string[] | null;
}

export type LeadStatus =
  | "cold"
  | "knocked_no_answer"
  | "conversation"
  | "interested"
  | "appointment_booked"
  | "signed"
  | "rejected"
  | "do_not_contact";

export interface CanvassLead {
  id: string;
  opco_id: string | null;
  territory_id: string | null;
  address: string;
  status: LeadStatus;
  contacted_by: string | null;
  contacted_at: string | null;
  last_notes: string | null;
  attempt_count: number;
  converted_to_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentType =
  | "enrollment"
  | "inspection"
  | "consultation"
  | "service_quote"
  | "follow_up";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

export interface Appointment {
  id: string;
  opco_id: string | null;
  member_id: string | null;
  lead_id: string | null;
  type: AppointmentType;
  scheduled_for: string;
  duration_minutes: number | null;
  assigned_to: string | null;
  status: AppointmentStatus;
  notes: string | null;
  booked_by: string | null;
  created_at: string;
}

export interface NoteEntry {
  id: string;
  opco_id: string | null;
  entity_type: string;
  entity_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  opco_id: string | null;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

// --- Phase 3: Inspection Engine --------------------------------------

export type CheckpointRating = "pass" | "warn" | "fail";

export type FindingSeverity =
  | "info"
  | "minor"
  | "moderate"
  | "severe"
  | "critical";

export type ConditionBand = "healthy" | "moderate" | "high_risk" | "critical";

export type RecommendedAction =
  | "maintain"
  | "repair"
  | "rejuvenate"
  | "replace_plan";

export type InspectionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "needs_review";

export interface TemplateCheckpoint {
  id: string;
  label: string;
  category: string;
  weight: number;
  order: number;
}

export interface InspectionTemplate {
  id: string;
  opco_id: string | null;
  name: string;
  version: number;
  active: boolean;
  checkpoints: TemplateCheckpoint[];
  created_at: string;
  updated_at: string;
}

export interface CheckpointResult {
  checkpoint_id: string;
  rating: CheckpointRating | null;
  notes: string | null;
  photo_urls: string[];
}

export interface Inspection {
  id: string;
  opco_id: string | null;
  property_id: string | null;
  member_id: string | null;
  appointment_id: string | null;
  inspector_id: string | null;
  template_id: string | null;
  template_version: number | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  overall_score: number | null;
  condition_band: ConditionBand | null;
  recommended_action: RecommendedAction | null;
  score_breakdown: Record<string, number> | null;
  photos_manifest: Record<string, unknown> | null;
  report_pdf_url: string | null;
  weather_at_inspection: string | null;
  duration_minutes: number | null;
  notes: string | null;
  status: InspectionStatus;
  checkpoint_results: CheckpointResult[] | null;
  created_at: string;
}

export interface InspectionFinding {
  id: string;
  inspection_id: string;
  category: string;
  severity: FindingSeverity;
  description: string;
  location: string | null;
  photo_urls: string[] | null;
  estimated_repair_cents: number | null;
  created_at: string;
}

export type OpportunityType =
  | "repair"
  | "rejuvenation"
  | "replacement_plan"
  | "warranty_claim";

export type OpportunityStatus =
  | "open"
  | "contacted"
  | "quoted"
  | "won"
  | "lost"
  | "on_hold";

export type OpportunityPriority = "low" | "normal" | "high" | "urgent";

export type OpportunityStage =
  | "prospecting"
  | "quoted"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "lost";

export interface Opportunity {
  id: string;
  opco_id: string | null;
  member_id: string | null;
  inspection_id: string | null;
  type: OpportunityType | null;
  status: OpportunityStatus;
  stage: OpportunityStage;
  stage_order: number;
  priority: OpportunityPriority;
  estimated_value_cents: number | null;
  value_estimate: number | null;
  assigned_specialist_id: string | null;
  assigned_to: string | null;
  expected_close_date: string | null;
  notes: string | null;
  lost_reason: string | null;
  opened_at: string | null;
  contacted_at: string | null;
  quoted_at: string | null;
  closed_at: string | null;
  won_job_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DecisionRuleConditions {
  score_lte?: number;
  score_gte?: number;
  score_between?: [number, number];
  has_finding_severity?: FindingSeverity[];
  has_finding_category?: string;
  severity_gte?: FindingSeverity;
  no_finding_severity_above?: FindingSeverity;
  roof_age_gte?: number;
}

export interface DecisionRuleAction {
  type: OpportunityType;
  priority: OpportunityPriority;
  notes_template: string;
}

export interface DecisionRuleActions {
  create_opportunity?: DecisionRuleAction;
  create_opportunity_secondary?: DecisionRuleAction;
  log_only?: boolean;
}

export interface DecisionRule {
  id: string;
  opco_id: string | null;
  name: string;
  description: string | null;
  priority: number;
  active: boolean;
  conditions: DecisionRuleConditions;
  actions: DecisionRuleActions;
  created_at: string;
  updated_at: string;
}

// --- Phase 4: Service Delivery ---------------------------------------

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired";

export type QuoteLineKind = "material" | "labor" | "fee" | "discount";

export interface Quote {
  id: string;
  opco_id: string;
  opportunity_id: string;
  quote_number: string;
  status: QuoteStatus;
  prepared_by: string | null;
  valid_until: string | null;
  subtotal_materials: number;
  subtotal_labor: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  accepted_at: string | null;
  accepted_by_member: boolean;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  kind: QuoteLineKind;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export type JobStatus =
  | "ready_to_schedule"
  | "scheduled"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type JobPriority = "urgent" | "high" | "normal" | "low";

export type JobType =
  | "repair"
  | "replacement"
  | "rejuvenation"
  | "maintenance"
  | "inspection_followup";

export interface Job {
  id: string;
  opco_id: string | null;
  member_id: string | null;
  property_id: string | null;
  opportunity_id: string | null;
  quote_id: string | null;
  job_type: JobType | null;
  status: JobStatus;
  priority: JobPriority;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  crew_id: string | null;
  specialist_id: string | null;
  project_manager_id: string | null;
  job_number: string | null;
  quoted_cents: number | null;
  final_cents: number | null;
  warranty_years: number | null;
  financing_type: string | null;
  scope_summary: string | null;
  completion_notes: string | null;
  completion_photo_urls: string[] | null;
  member_signature_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Crew {
  id: string;
  opco_id: string;
  name: string;
  crew_code: string;
  lead_id: string | null;
  active: boolean;
  specialties: string[] | null;
  max_concurrent_jobs: number;
  home_base: string | null;
  notes: string | null;
  type: string | null;
  created_at: string;
  updated_at: string | null;
}

export type CrewMemberRole = "lead" | "tech" | "helper";

export interface CrewMemberRow {
  id: string;
  crew_id: string;
  profile_id: string;
  role: CrewMemberRole;
  joined_at: string;
  left_at: string | null;
}

export type CrewAvailabilityKind = "working_hours" | "time_off" | "holiday";

export interface CrewAvailability {
  id: string;
  crew_id: string;
  kind: CrewAvailabilityKind;
  weekday: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

// --- Phase 5: Monetization -----------------------------------------

export type SubscriptionFrequency = "annual" | "monthly" | "quarterly";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "ended"
  | "trialing";

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  tier_level: number;
  annual_price_cents: number;
  monthly_price_cents: number;
  quarterly_price_cents: number;
  stripe_product_id: string | null;
  stripe_price_annual_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_quarterly_id: string | null;
  features: string[];
  cra_enrollment_commission_cents: number;
  cra_renewal_residual_pct: number;
  active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  opco_id: string;
  member_id: string;
  plan_id: string;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cancellation_reason: string | null;
  enrolled_by: string | null;
  enrolled_at: string;
  price_at_enrollment_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceKind =
  | "subscription_initial"
  | "subscription_renewal"
  | "subscription_upgrade"
  | "job_invoice"
  | "manual";

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void";

export interface Invoice {
  id: string;
  opco_id: string;
  member_id: string | null;
  subscription_id: string | null;
  job_id: string | null;
  stripe_invoice_id: string | null;
  kind: InvoiceKind;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_remaining_cents: number;
  currency: string;
  issued_at: string | null;
  paid_at: string | null;
  due_at: string | null;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CommissionKind =
  | "cra_enrollment"
  | "cra_renewal"
  | "sales_manager_override"
  | "specialist_job";

export type CommissionStatus =
  | "pending"
  | "approved"
  | "paid"
  | "reversed"
  | "forfeited";

export type CommissionSourceType = "subscription" | "invoice" | "job";

export interface Commission {
  id: string;
  opco_id: string;
  profile_id: string;
  kind: CommissionKind;
  source_type: CommissionSourceType;
  source_id: string;
  basis_cents: number;
  rate: number | null;
  amount_cents: number;
  status: CommissionStatus;
  period_year: number | null;
  period_month: number | null;
  earned_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_reference: string | null;
  reversal_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface OpcoStripeAccount {
  id: string;
  opco_id: string;
  stripe_account_id: string | null;
  account_type: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed_at: string | null;
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
}
