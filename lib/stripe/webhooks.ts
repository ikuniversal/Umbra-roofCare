import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/lib/types";

// Event handler router. Each branch must be idempotent — the outer
// route handler records the raw event via stripe_event_id unique index,
// so even if a handler retries, the DB-level dedupe prevents
// double-booking.

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event);
      break;
    case "customer.subscription.deleted":
      await markSubscriptionCanceled(event);
      break;
    case "invoice.paid":
      await recordInvoicePayment(event, true);
      break;
    case "invoice.payment_failed":
      await recordInvoicePayment(event, false);
      break;
    case "charge.refunded":
      await reverseCommissionsForCharge(event);
      break;
    case "account.updated":
      await syncConnectAccount(event);
      break;
    default:
      // No-op — logged upstream.
      break;
  }
}

// Maps Stripe's subscription statuses onto our narrower set.
function mapStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
    case "past_due":
    case "paused":
    case "canceled":
      return stripeStatus as SubscriptionStatus;
    case "incomplete":
    case "incomplete_expired":
      return "pending";
    case "unpaid":
      return "past_due";
    default:
      return "pending";
  }
}

// The Stripe SDK has tightened a handful of types in recent versions
// (current_period_start now lives per-item, Invoice.subscription/tax and
// Charge.invoice are deprecated). We widen the event payload shapes here
// so the webhook handler compiles across SDK versions while still
// reading the fields that Stripe sends on the wire.
type StripeSubscriptionLoose = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};
type StripeInvoiceLoose = Stripe.Invoice & {
  subscription?: string | { id: string } | null;
  tax?: number | null;
};
type StripeChargeLoose = Stripe.Charge & {
  invoice?: string | { id: string } | null;
};

async function upsertSubscription(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as StripeSubscriptionLoose;
  const admin = createAdminClient();

  const memberId = sub.metadata?.member_id ?? null;
  const planId = sub.metadata?.plan_id ?? null;
  const frequency = (sub.metadata?.frequency ?? "annual") as
    | "annual"
    | "monthly"
    | "quarterly";
  const enrolledBy = sub.metadata?.enrolled_by || null;

  if (!memberId || !planId) {
    // Not an Umbra-managed subscription; skip.
    return;
  }

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, opco_id, plan_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  // Get member + plan for context; rely on service-role to bypass RLS.
  const { data: member } = await admin
    .from("members")
    .select("opco_id")
    .eq("id", memberId)
    .maybeSingle<{ opco_id: string | null }>();
  const { data: plan } = await admin
    .from("subscription_plans")
    .select("annual_price_cents, monthly_price_cents, quarterly_price_cents")
    .eq("id", planId)
    .maybeSingle<{
      annual_price_cents: number;
      monthly_price_cents: number;
      quarterly_price_cents: number;
    }>();

  const priceAtEnrollment =
    plan
      ? frequency === "annual"
        ? plan.annual_price_cents
        : frequency === "monthly"
          ? plan.monthly_price_cents
          : plan.quarterly_price_cents
      : 0;

  const row = {
    opco_id: member?.opco_id ?? existing?.opco_id,
    member_id: memberId,
    plan_id: planId,
    frequency,
    status: mapStatus(sub.status),
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripe_subscription_id: sub.id,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    trial_end: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    canceled_at: sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString()
      : null,
    enrolled_by: enrolledBy,
    price_at_enrollment_cents: priceAtEnrollment,
  };

  let subscriptionRowId = existing?.id;

  if (existing) {
    await admin
      .from("subscriptions")
      .update(row)
      .eq("id", existing.id);
  } else {
    if (!row.opco_id) return;
    const { data: inserted } = await admin
      .from("subscriptions")
      .insert({ ...row, enrolled_at: new Date().toISOString() })
      .select("id")
      .maybeSingle<{ id: string }>();
    subscriptionRowId = inserted?.id;
  }

  // Fire enrollment commission for newly-created records only.
  if (event.type === "customer.subscription.created" && subscriptionRowId) {
    await admin.rpc("create_cra_enrollment_commission", {
      p_subscription_id: subscriptionRowId,
    });
  }
}

async function markSubscriptionCanceled(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as StripeSubscriptionLoose;
  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
}

async function recordInvoicePayment(
  event: Stripe.Event,
  succeeded: boolean,
): Promise<void> {
  const inv = event.data.object as StripeInvoiceLoose;
  const admin = createAdminClient();

  // Upsert the invoice row.
  const status = succeeded
    ? "paid"
    : inv.status === "uncollectible"
      ? "uncollectible"
      : "open";

  const isSubscriptionInvoice = Boolean(inv.subscription);
  const kind = isSubscriptionInvoice
    ? (inv.billing_reason === "subscription_create"
        ? "subscription_initial"
        : inv.billing_reason === "subscription_cycle"
          ? "subscription_renewal"
          : inv.billing_reason === "subscription_update"
            ? "subscription_upgrade"
            : "subscription_renewal")
    : "manual";

  const { data: subRow } = inv.subscription
    ? await admin
        .from("subscriptions")
        .select("id, opco_id, member_id")
        .eq(
          "stripe_subscription_id",
          typeof inv.subscription === "string"
            ? inv.subscription
            : inv.subscription.id,
        )
        .maybeSingle<{
          id: string;
          opco_id: string;
          member_id: string;
        }>()
    : { data: null };

  const row = {
    opco_id: subRow?.opco_id,
    member_id: subRow?.member_id ?? null,
    subscription_id: subRow?.id ?? null,
    stripe_invoice_id: inv.id,
    kind,
    status: status as "paid" | "open" | "uncollectible",
    subtotal_cents: inv.subtotal ?? 0,
    tax_cents: inv.tax ?? 0,
    total_cents: inv.total ?? 0,
    amount_paid_cents: inv.amount_paid ?? 0,
    amount_remaining_cents: inv.amount_remaining ?? 0,
    currency: inv.currency ?? "usd",
    issued_at: inv.created
      ? new Date(inv.created * 1000).toISOString()
      : null,
    paid_at: succeeded && inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null,
    due_at: inv.due_date
      ? new Date(inv.due_date * 1000).toISOString()
      : null,
    hosted_invoice_url: inv.hosted_invoice_url ?? null,
    pdf_url: inv.invoice_pdf ?? null,
  };

  if (!row.opco_id) return;

  const { data: existing } = await admin
    .from("invoices")
    .select("id")
    .eq("stripe_invoice_id", inv.id ?? "")
    .maybeSingle<{ id: string }>();

  let invoiceRowId = existing?.id;
  if (existing) {
    await admin.from("invoices").update(row).eq("id", existing.id);
  } else {
    const { data: inserted } = await admin
      .from("invoices")
      .insert(row)
      .select("id")
      .maybeSingle<{ id: string }>();
    invoiceRowId = inserted?.id;
  }

  // For subscription renewals/paid invoices, trigger the CRA renewal
  // residual. Enrollment commissions fire off customer.subscription.created.
  if (
    succeeded &&
    invoiceRowId &&
    subRow?.id &&
    (kind === "subscription_renewal" || kind === "subscription_upgrade")
  ) {
    await admin.rpc("create_cra_renewal_residual", {
      p_subscription_id: subRow.id,
      p_invoice_id: invoiceRowId,
    });
  }

  // Failed payments → flag subscription past_due.
  if (!succeeded && subRow?.id) {
    await admin
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("id", subRow.id);
  }
}

async function reverseCommissionsForCharge(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as StripeChargeLoose;
  const admin = createAdminClient();

  const stripeInvoiceId = charge.invoice
    ? typeof charge.invoice === "string"
      ? charge.invoice
      : charge.invoice.id
    : null;
  if (!stripeInvoiceId) return;

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, total_cents")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle<{ id: string; total_cents: number }>();
  if (!invoice) return;

  // Reverse any pending/approved commissions tied to this invoice.
  await admin
    .from("commissions")
    .update({
      status: "reversed",
      reversal_reason: `Refund on charge ${charge.id}`,
    })
    .eq("source_type", "invoice")
    .eq("source_id", invoice.id)
    .in("status", ["pending", "approved", "paid"]);
}

async function syncConnectAccount(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("opco_stripe_accounts")
    .select("id, opco_id")
    .eq("stripe_account_id", account.id)
    .maybeSingle<{ id: string; opco_id: string }>();
  if (!row) return;

  await admin
    .from("opco_stripe_accounts")
    .update({
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      disabled_reason:
        account.requirements?.disabled_reason
          ? String(account.requirements.disabled_reason)
          : null,
      onboarding_completed_at:
        account.details_submitted && account.charges_enabled
          ? new Date().toISOString()
          : null,
    })
    .eq("id", row.id);
}
