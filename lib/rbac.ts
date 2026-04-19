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

// --- Phase 2: Member Lifecycle permissions ---------------------------
// RLS still enforces tenancy at the DB — these helpers gate UI affordances
// and mutation paths so we fail fast with clear messages instead of
// surfacing raw Supabase errors.

const OPCO_MANAGERS: Role[] = [
  "opco_gm",
  "sales_manager",
  "area_manager",
  "team_lead",
];

export function canManageMembers(roles: Role[]): boolean {
  return isPlatformAdmin(roles) || hasRole(roles, OPCO_MANAGERS);
}

export function canCreateMember(roles: Role[]): boolean {
  return (
    canManageMembers(roles) ||
    roles.includes("cra") ||
    roles.includes("setter")
  );
}

export function canEditMember(
  roles: Role[],
  member: { primary_cra_id: string | null; created_by: string | null },
  userId: string,
): boolean {
  if (canManageMembers(roles)) return true;
  if (roles.includes("cra") && member.primary_cra_id === userId) return true;
  if (roles.includes("csm") && member.primary_cra_id === userId) return true;
  return member.created_by === userId;
}

export function canManageTerritories(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("sales_manager")
  );
}

export function canWorkLeads(roles: Role[]): boolean {
  return (
    canManageMembers(roles) ||
    roles.includes("setter") ||
    roles.includes("cra")
  );
}

export function canEditLead(
  roles: Role[],
  lead: { contacted_by: string | null },
  userId: string,
): boolean {
  if (canManageMembers(roles)) return true;
  if (!lead.contacted_by) return canWorkLeads(roles);
  return lead.contacted_by === userId;
}

export function canBookAppointment(roles: Role[]): boolean {
  return canManageMembers(roles) ||
    roles.includes("cra") ||
    roles.includes("setter") ||
    roles.includes("csm");
}

export function canCompleteAppointment(
  roles: Role[],
  appointment: { assigned_to: string | null; booked_by: string | null },
  userId: string,
): boolean {
  if (canManageMembers(roles)) return true;
  return (
    appointment.assigned_to === userId || appointment.booked_by === userId
  );
}

// --- Phase 3: Inspection Engine permissions --------------------------

export function canScheduleInspection(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    hasRole(roles, OPCO_MANAGERS) ||
    roles.includes("cra") ||
    roles.includes("csm")
  );
}

export function canCaptureInspection(
  roles: Role[],
  inspection: { inspector_id: string | null; status: string },
  userId: string,
): boolean {
  if (inspection.status === "completed" || inspection.status === "cancelled") {
    return false;
  }
  if (isPlatformAdmin(roles)) return true;
  if (hasRole(roles, OPCO_MANAGERS)) return true;
  if (roles.includes("inspector")) {
    return (
      inspection.inspector_id === userId || inspection.inspector_id === null
    );
  }
  return false;
}

export function canEditInspection(
  roles: Role[],
  inspection: { inspector_id: string | null; status: string },
  userId: string,
): boolean {
  return canCaptureInspection(roles, inspection, userId);
}

export function canViewInspectionReport(roles: Role[]): boolean {
  // Read access: everyone inside the OpCo. RLS enforces tenancy.
  return roles.length > 0;
}

export function canEditInspectionTemplate(roles: Role[]): boolean {
  return isPlatformAdmin(roles) || roles.includes("opco_gm");
}

export function canEditDecisionRules(roles: Role[]): boolean {
  return isPlatformAdmin(roles) || roles.includes("opco_gm");
}

export function canAddInspectionFinding(
  roles: Role[],
  inspection: { inspector_id: string | null; status: string },
  userId: string,
): boolean {
  return canCaptureInspection(roles, inspection, userId);
}

// --- Phase 4: Service Delivery permissions ---------------------------

export function canViewOpportunities(roles: Role[]): boolean {
  if (roles.length === 0) return false;
  if (roles.length === 1 && roles[0] === "crew_member") return false;
  return true;
}

export function canEditOpportunity(
  roles: Role[],
  opportunity: { assigned_specialist_id: string | null; assigned_to: string | null },
  userId: string,
): boolean {
  if (isPlatformAdmin(roles)) return true;
  if (hasRole(roles, OPCO_MANAGERS)) return true;
  if (roles.includes("cra")) return true;
  if (
    roles.includes("specialist") &&
    (opportunity.assigned_specialist_id === userId ||
      opportunity.assigned_to === userId)
  ) {
    return true;
  }
  return false;
}

export function canDragOpportunityStage(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    hasRole(roles, OPCO_MANAGERS) ||
    roles.includes("cra") ||
    roles.includes("specialist")
  );
}

export function canCreateQuote(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("sales_manager") ||
    roles.includes("specialist")
  );
}

export function canEditQuote(
  roles: Role[],
  quote: { prepared_by: string | null },
  userId: string,
): boolean {
  if (isPlatformAdmin(roles) || roles.includes("opco_gm")) return true;
  if (roles.includes("sales_manager")) return true;
  if (canCreateQuote(roles) && quote.prepared_by === userId) return true;
  return false;
}

export function canDeleteQuote(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("sales_manager")
  );
}

export function canAcceptQuote(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("sales_manager")
  );
}

export function canViewJobs(roles: Role[]): boolean {
  // Setter is canvass-only.
  if (roles.length === 1 && roles[0] === "setter") return false;
  return roles.length > 0;
}

export function canScheduleJob(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("sales_manager") ||
    roles.includes("area_manager") ||
    roles.includes("team_lead")
  );
}

export function canCompleteJob(
  roles: Role[],
  job: { crew_id: string | null },
  userId: string,
  assignedCrewMemberIds: string[],
): boolean {
  if (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("area_manager") ||
    roles.includes("team_lead")
  ) {
    return true;
  }
  if (
    roles.includes("crew_member") &&
    job.crew_id &&
    assignedCrewMemberIds.includes(userId)
  ) {
    return true;
  }
  return false;
}

export function canManageCrews(roles: Role[]): boolean {
  return (
    isPlatformAdmin(roles) ||
    roles.includes("opco_gm") ||
    roles.includes("area_manager")
  );
}
