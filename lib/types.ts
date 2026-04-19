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

export interface Opportunity {
  id: string;
  opco_id: string | null;
  member_id: string | null;
  inspection_id: string | null;
  type: OpportunityType | null;
  status: OpportunityStatus;
  priority: OpportunityPriority;
  estimated_value_cents: number | null;
  assigned_specialist_id: string | null;
  notes: string | null;
  opened_at: string | null;
  contacted_at: string | null;
  quoted_at: string | null;
  closed_at: string | null;
  created_at: string;
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
