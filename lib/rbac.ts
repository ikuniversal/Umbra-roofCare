import type { Role } from "./types";

export const ROLES: Role[] = [
  "super_admin",
  "executive",
  "corp_dev",
  "opco_gm",
  "sales_manager",
  "area_manager",
  "team_lead",
  "cra",
  "setter",
  "inspector",
  "specialist",
  "csm",
  "crew_member",
];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  executive: "Executive",
  corp_dev: "Corporate Development",
  opco_gm: "OpCo General Manager",
  sales_manager: "Sales Manager",
  area_manager: "Area Manager",
  team_lead: "Team Lead",
  cra: "Certified Roof Advisor",
  setter: "Setter",
  inspector: "Inspector",
  specialist: "Authorized Service Specialist",
  csm: "Customer Success Manager",
  crew_member: "Crew Member",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full platform access across all OpCos.",
  executive: "Read across all OpCos for leadership reporting.",
  corp_dev: "M&A and portfolio-level visibility.",
  opco_gm: "Runs a single OpCo end-to-end.",
  sales_manager: "Owns sales performance within an OpCo.",
  area_manager: "Field lead across teams.",
  team_lead: "Leads a setter/CRA team.",
  cra: "Certified Roof Advisor — enrolls members, manages relationships.",
  setter: "Canvasses and books appointments.",
  inspector: "Performs scored roof inspections.",
  specialist: "Authorized Service Specialist — delivers services and upsells.",
  csm: "Customer Success Manager — retention and renewals.",
  crew_member: "Performs inspection, maintenance, or repair work.",
};

const ADMIN_ROLES: Role[] = ["super_admin", "executive", "corp_dev"];

export const PLATFORM_ADMIN_ROLES = ADMIN_ROLES;

export function isPlatformAdmin(roles: Role[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

export function isSuperAdmin(roles: Role[]): boolean {
  return roles.includes("super_admin");
}

export function canManageOrganizations(roles: Role[]): boolean {
  return isSuperAdmin(roles);
}

export function canInviteUsers(roles: Role[]): boolean {
  return roles.includes("super_admin") || roles.includes("opco_gm");
}

export function canViewSettings(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("sales_manager")
  );
}

export function hasRole(userRoles: Role[], role: Role | Role[]): boolean {
  const wanted = Array.isArray(role) ? role : [role];
  return userRoles.some((r) => wanted.includes(r));
}
