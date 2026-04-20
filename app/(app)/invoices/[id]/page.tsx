import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewInvoices } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Invoice,
  Job,
  Member,
  Subscription,
  SubscriptionPlan,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InvoiceKindBadge,
  InvoiceStatusBadge,
} from "@/components/monetization/status-badges";
import { formatCents } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canViewInvoices(session.roles)) notFound();
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle<Invoice>();
  if (!invoice) notFound();

  const [memberRes, subRes, jobRes] = await Promise.all([
    invoice.member_id
      ? supabase
          .from("members")
          .select("*")
          .eq("id", invoice.member_id)
          .maybeSingle<Member>()
      : Promise.resolve({ data: null }),
    invoice.subscription_id
      ? supabase
          .from("subscriptions")
          .select("*, subscription_plans!inner(*)")
          .eq("id", invoice.subscription_id)
          .maybeSingle<Subscription & { subscription_plans: SubscriptionPlan }>()
      : Promise.resolve({ data: null }),
    invoice.job_id
      ? supabase
          .from("jobs")
          .select("id, job_number, status")
          .eq("id", invoice.job_id)
          .maybeSingle<Pick<Job, "id" | "job_number" | "status">>()
      : Promise.resolve({ data: null }),
  ]);

  const member = memberRes.data as Member | null;
  const sub = subRes.data as
    | (Subscription & { subscription_plans: SubscriptionPlan })
    | null;
  const job = jobRes.data as Pick<Job, "id" | "job_number" | "status"> | null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Monetization · Phase 5"
        title={invoice.stripe_invoice_id ?? "Invoice"}
        description={
          member
            ? `${member.first_name} ${member.last_name}`
            : "Invoice detail"
        }
        actions={
          <div className="flex items-center gap-2">
            <InvoiceKindBadge kind={invoice.kind} />
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.hosted_invoice_url ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={invoice.hosted_invoice_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Stripe invoice
                </a>
              </Button>
            ) : null}
            {invoice.pdf_url ? (
              <Button asChild size="sm">
                <a href={invoice.pdf_url} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_240px]">
        <Card>
          <CardHeader>
            <p className="label-mono">Summary</p>
            <CardTitle>Amounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatCents(invoice.subtotal_cents)} />
            <Row label="Tax" value={formatCents(invoice.tax_cents)} />
            <Row label="Total" value={formatCents(invoice.total_cents)} bold />
            <Row label="Paid" value={formatCents(invoice.amount_paid_cents)} />
            <Row
              label="Remaining"
              value={formatCents(invoice.amount_remaining_cents)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="label-mono">Timeline</p>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Issued" value={formatDate(invoice.issued_at)} />
            <Row label="Due" value={formatDate(invoice.due_at)} />
            <Row label="Paid" value={formatDateTime(invoice.paid_at)} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {sub ? (
          <Card>
            <CardHeader>
              <p className="label-mono">Linked subscription</p>
              <CardTitle>{sub.subscription_plans.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Frequency" value={sub.frequency} />
              <Row label="Status" value={sub.status} />
              <Row
                label="Price at enrollment"
                value={formatCents(sub.price_at_enrollment_cents)}
              />
              <Row
                label="Stripe ID"
                value={sub.stripe_subscription_id ?? "—"}
              />
              {member ? (
                <Link
                  href={`/members/${member.id}`}
                  className="mt-2 inline-block text-xs text-brand-accent hover:underline"
                >
                  Member profile →
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {job ? (
          <Card>
            <CardHeader>
              <p className="label-mono">Linked job</p>
              <CardTitle>{job.job_number ?? job.id.slice(0, 8)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Status" value={job.status} />
              <Link
                href={`/jobs/${job.id}`}
                className="mt-2 inline-block text-xs text-brand-accent hover:underline"
              >
                Job detail →
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {invoice.notes ? (
        <Card className="mt-6">
          <CardHeader>
            <p className="label-mono">Notes</p>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm text-brand-primary">
            {invoice.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="label-mono">{label}</p>
      <p
        className={
          bold
            ? "metric-figure text-lg text-brand-primary"
            : "text-brand-primary"
        }
      >
        {value}
      </p>
    </div>
  );
}
