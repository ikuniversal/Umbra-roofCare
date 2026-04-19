import type {
  AppointmentStatus,
  AppointmentType,
  CheckpointRating,
  ConditionBand,
  FindingSeverity,
  InspectionStatus,
  LeadStatus,
  MemberStatus,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityType,
  RecommendedAction,
  RoofMaterial,
} from "@/lib/types";

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  prospect: "Prospect",
  member: "Member",
  paused: "Paused",
  cancelled: "Cancelled",
  churned: "Churned",
};

export const MEMBER_STATUS_VARIANTS: Record<
  MemberStatus,
  "default" | "primary" | "accent" | "success" | "warn" | "error" | "outline"
> = {
  prospect: "accent",
  member: "success",
  paused: "warn",
  cancelled: "outline",
  churned: "error",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  cold: "Cold",
  knocked_no_answer: "No answer",
  conversation: "Conversation",
  interested: "Interested",
  appointment_booked: "Appointment",
  signed: "Signed",
  rejected: "Rejected",
  do_not_contact: "Do not contact",
};

export const LEAD_STATUS_VARIANTS: Record<
  LeadStatus,
  "default" | "primary" | "accent" | "success" | "warn" | "error" | "outline"
> = {
  cold: "outline",
  knocked_no_answer: "default",
  conversation: "primary",
  interested: "accent",
  appointment_booked: "accent",
  signed: "success",
  rejected: "warn",
  do_not_contact: "error",
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "cold",
  "knocked_no_answer",
  "conversation",
  "interested",
  "appointment_booked",
  "signed",
  "rejected",
  "do_not_contact",
];

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  enrollment: "Enrollment",
  inspection: "Inspection",
  consultation: "Consultation",
  service_quote: "Service quote",
  follow_up: "Follow up",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  rescheduled: "Rescheduled",
};

export const APPOINTMENT_STATUS_VARIANTS: Record<
  AppointmentStatus,
  "default" | "primary" | "accent" | "success" | "warn" | "error" | "outline"
> = {
  scheduled: "primary",
  confirmed: "accent",
  completed: "success",
  cancelled: "outline",
  no_show: "error",
  rescheduled: "warn",
};

export const ROOF_MATERIAL_LABELS: Record<RoofMaterial, string> = {
  composition_shingle: "Composition shingle",
  standing_seam_metal: "Standing-seam metal",
  tile_concrete: "Concrete tile",
  tile_clay: "Clay tile",
  slate: "Slate",
  wood_shake: "Wood shake",
  flat_membrane: "Flat membrane",
  other: "Other",
};

// --- Phase 3: Inspection Engine --------------------------------------

type BadgeVariant =
  | "default"
  | "primary"
  | "accent"
  | "success"
  | "warn"
  | "error"
  | "outline";

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  needs_review: "Needs review",
};

export const INSPECTION_STATUS_VARIANTS: Record<
  InspectionStatus,
  BadgeVariant
> = {
  scheduled: "primary",
  in_progress: "accent",
  completed: "success",
  cancelled: "outline",
  needs_review: "warn",
};

export const CONDITION_BAND_LABELS: Record<ConditionBand, string> = {
  healthy: "Healthy",
  moderate: "Moderate",
  high_risk: "High risk",
  critical: "Critical",
};

export const CONDITION_BAND_VARIANTS: Record<ConditionBand, BadgeVariant> = {
  healthy: "success",
  moderate: "accent",
  high_risk: "warn",
  critical: "error",
};

export const RECOMMENDED_ACTION_LABELS: Record<RecommendedAction, string> = {
  maintain: "Maintain",
  repair: "Repair",
  rejuvenate: "Rejuvenate",
  replace_plan: "Replacement plan",
};

export const CHECKPOINT_RATING_LABELS: Record<CheckpointRating, string> = {
  pass: "Pass",
  warn: "Watch",
  fail: "Fail",
};

export const CHECKPOINT_RATING_MULTIPLIER: Record<CheckpointRating, number> = {
  pass: 1.0,
  warn: 0.5,
  fail: 0.0,
};

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  info: "Info",
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
  critical: "Critical",
};

export const FINDING_SEVERITY_VARIANTS: Record<FindingSeverity, BadgeVariant> =
  {
    info: "outline",
    minor: "default",
    moderate: "accent",
    severe: "warn",
    critical: "error",
  };

export const FINDING_SEVERITY_ORDER: FindingSeverity[] = [
  "info",
  "minor",
  "moderate",
  "severe",
  "critical",
];

export const FINDING_CATEGORIES: { value: string; label: string }[] = [
  { value: "shingle", label: "Shingle" },
  { value: "flashing", label: "Flashing" },
  { value: "drainage", label: "Drainage" },
  { value: "structural", label: "Structural" },
  { value: "water_staining", label: "Water staining" },
  { value: "ventilation", label: "Ventilation" },
  { value: "penetration", label: "Penetration" },
  { value: "surface", label: "Surface" },
  { value: "other", label: "Other" },
];

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  repair: "Repair",
  rejuvenation: "Rejuvenation",
  replacement_plan: "Replacement plan",
  warranty_claim: "Warranty claim",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  open: "Open",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  on_hold: "On hold",
};

export const OPPORTUNITY_PRIORITY_LABELS: Record<OpportunityPriority, string> =
  {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };

export const OPPORTUNITY_PRIORITY_VARIANTS: Record<
  OpportunityPriority,
  BadgeVariant
> = {
  low: "outline",
  normal: "default",
  high: "warn",
  urgent: "error",
};
