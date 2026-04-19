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
