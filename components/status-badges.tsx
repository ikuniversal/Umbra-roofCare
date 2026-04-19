import { Badge } from "@/components/ui/badge";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANTS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VARIANTS,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUS_VARIANTS,
} from "@/lib/labels";
import type {
  AppointmentStatus,
  LeadStatus,
  MemberStatus,
} from "@/lib/types";

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge variant={MEMBER_STATUS_VARIANTS[status]}>
      {MEMBER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={LEAD_STATUS_VARIANTS[status]}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <Badge variant={APPOINTMENT_STATUS_VARIANTS[status]}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
