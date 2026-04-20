import { Badge } from "@/components/ui/badge";
import {
  COMMISSION_KIND_LABELS,
  COMMISSION_STATUS_LABELS,
  COMMISSION_STATUS_VARIANTS,
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANTS,
  SUBSCRIPTION_FREQUENCY_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_VARIANTS,
} from "@/lib/labels";
import type {
  CommissionKind,
  CommissionStatus,
  InvoiceKind,
  InvoiceStatus,
  SubscriptionFrequency,
  SubscriptionStatus,
} from "@/lib/types";

export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  return (
    <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[status]}>
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function FrequencyBadge({
  frequency,
}: {
  frequency: SubscriptionFrequency;
}) {
  return <Badge variant="outline">{SUBSCRIPTION_FREQUENCY_LABELS[frequency]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant={INVOICE_STATUS_VARIANTS[status]}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function InvoiceKindBadge({ kind }: { kind: InvoiceKind }) {
  return <Badge variant="outline">{INVOICE_KIND_LABELS[kind]}</Badge>;
}

export function CommissionStatusBadge({
  status,
}: {
  status: CommissionStatus;
}) {
  return (
    <Badge variant={COMMISSION_STATUS_VARIANTS[status]}>
      {COMMISSION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CommissionKindBadge({ kind }: { kind: CommissionKind }) {
  return <Badge variant="outline">{COMMISSION_KIND_LABELS[kind]}</Badge>;
}
