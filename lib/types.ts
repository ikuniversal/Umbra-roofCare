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
