import type {
  AppointmentStatus,
  AppointmentType,
  LeadStatus,
  MemberStatus,
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
