import { Badge } from "@/components/ui/badge";
import {
  CONDITION_BAND_LABELS,
  CONDITION_BAND_VARIANTS,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_VARIANTS,
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUS_VARIANTS,
  OPPORTUNITY_PRIORITY_LABELS,
  OPPORTUNITY_PRIORITY_VARIANTS,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_TYPE_LABELS,
} from "@/lib/labels";
import type {
  ConditionBand,
  FindingSeverity,
  InspectionStatus,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityType,
} from "@/lib/types";

export function InspectionStatusBadge({
  status,
}: {
  status: InspectionStatus;
}) {
  return (
    <Badge variant={INSPECTION_STATUS_VARIANTS[status]}>
      {INSPECTION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ConditionBandBadge({ band }: { band: ConditionBand }) {
  return (
    <Badge variant={CONDITION_BAND_VARIANTS[band]}>
      {CONDITION_BAND_LABELS[band]}
    </Badge>
  );
}

export function FindingSeverityBadge({
  severity,
}: {
  severity: FindingSeverity;
}) {
  return (
    <Badge variant={FINDING_SEVERITY_VARIANTS[severity]}>
      {FINDING_SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function OpportunityTypeBadge({ type }: { type: OpportunityType }) {
  return <Badge variant="primary">{OPPORTUNITY_TYPE_LABELS[type]}</Badge>;
}

export function OpportunityPriorityBadge({
  priority,
}: {
  priority: OpportunityPriority;
}) {
  return (
    <Badge variant={OPPORTUNITY_PRIORITY_VARIANTS[priority]}>
      {OPPORTUNITY_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function OpportunityStatusBadge({
  status,
}: {
  status: OpportunityStatus;
}) {
  return <Badge variant="outline">{OPPORTUNITY_STATUS_LABELS[status]}</Badge>;
}
