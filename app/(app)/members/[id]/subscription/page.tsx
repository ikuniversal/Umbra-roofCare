import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canEnrollMember } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Invoice,
  Member,
  Subscription,
  SubscriptionPlan,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FrequencyBadge,
  InvoiceKindBadge,
  InvoiceStatusBadge,
  SubscriptionStatusBadge,
} from "@/components/monetization/status-badges";
import { EnrollmentFlow } from "./enrollment-flow";
import { SubscriptionActions } from "./subscription-actions";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export default async function MemberSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle<Member & { stripe_customer_id: string | null }>();
  if (!member) notFound();

  const [{ data: subsData }, { data: plansData }, { data: invoicesData }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("member_id", id)
        .order("enrolled_at", { ascending: false }),
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("tier_level", { ascending: true }),
      supabase
        .from("invoices")
        .select("*")
        .eq("member_id", id)
        .order("issued_at", { ascending: false, nullsFirst: false })
        .limit(20),
    ]);

  const subs = (subsData ?? []) as Subscription[];
  const plans = (plansData ?? []) as SubscriptionPlan[];
  const invoices = (invoicesData ?? []) as Invoice[];
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
  const current =
    subs.find((s) => s.status === "active" || s.status === "trialing") ??
    subs[0] ??
    null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Monetization · Phase 5"
        title={`${member.first_name} ${member.last_name}`}
        description="Membership, billing, and payment history."
        actions={
          <Button asChild variant="outline">
            <Link href={`/members/${member.id}`}>Member profile</Link>
          </Button>
        }
      />

      {current && current.status !== "canceled" && current.status !== "ended" ? (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="label-mono">Active subscription</p>
                <CardTitle>
                  {planMap[current.plan_id]?.name ?? "Plan"}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <SubscriptionStatusBadge status={current.status} />
                <FrequencyBadge frequency={current.frequency} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label="Locked-in price"
              value={formatCents(current.price_at_enrollment_cents)}
            />
            <Row
              label="Current period"
              value={`${formatDate(current.current_period_start)} – ${formatDate(current.current_period_end)}`}
            />
            {current.canceled_at ? (
              <Row
                label="Canceled at"
                value={formatDate(current.canceled_at)}
              />
            ) : null}
            <SubscriptionActions
              memberId={member.id}
              subscription={current}
              plans={plans}
            />
          </CardContent>
        </Card>
      ) : canEnrollMember(session.roles) ? (
        <Card className="mt-6">
          <CardHeader>
            <p className="label-mono">Enroll in RoofCare</p>
            <CardTitle>Pick a tier</CardTitle>
          </CardHeader>
          <CardContent>
            <EnrollmentFlow
              memberId={member.id}
              plans={plans}
              hasCustomer={Boolean(member.stripe_customer_id)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-sm text-brand-muted">
            No active subscription. Ask your CRA to enroll this member.
          </CardContent>
        </Card>
      )}

      {subs.length > 1 ? (
        <section className="mt-8">
          <p className="label-mono mb-3">Subscription history</p>
          <ul className="space-y-2">
            {subs.slice(1).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-brand-border bg-brand-card px-4 py-3 text-sm"
              >
                <span className="text-brand-primary">
                  {planMap[s.plan_id]?.name ?? "Plan"}
                </span>
                <div className="flex items-center gap-2">
                  <FrequencyBadge frequency={s.frequency} />
                  <SubscriptionStatusBadge status={s.status} />
                  <span className="text-xs text-brand-muted">
                    {formatDate(s.enrolled_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <p className="label-mono mb-3">Recent invoices</p>
        {invoices.length === 0 ? (
          <p className="rounded-md border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
            No invoices yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border rounded-md border border-brand-border bg-brand-card">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <InvoiceKindBadge kind={inv.kind} />
                  <span className="text-sm text-brand-muted">
                    {formatDate(inv.issued_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="metric-figure text-sm text-brand-primary">
                    {formatCents(inv.total_cents)}
                  </span>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Detail →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="label-mono">{label}</p>
      <p className="text-brand-primary">{value}</p>
    </div>
  );
}
