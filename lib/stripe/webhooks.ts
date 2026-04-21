import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  InvoiceKind,
  InvoiceStatus,
  SubscriptionFrequency,
  SubscriptionStatus,
} from "@/lib/types";

// Webhook event router. Two idempotency guarantees:
//   * Outer route handler inserts the raw event under a unique
//     stripe_event_id index, so duplicate deliveries short-circuit
//     before the dispatcher runs.
//   * Every branch here is safe to run multiple times: subscription +
//     invoice upserts look up the row by Stripe ID first, update if
//     present, insert otherwise. The commission RPCs have their own
//     source_id guards.
//
// Stripe delivery ordering is NOT guaranteed. Most notably, invoice.*
// events frequently arrive before customer.subscription.created. Both
// the subscription and invoice handlers below therefore tolerate
// out-of-order delivery — the invoice handler creates a skeleton
// subscription row when needed, derived from the invoice's customer +
// line item, and the later subscription event updates that skeleton
// with the full metadata.

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

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event);
      break;
    case "customer.subscription.deleted":
      await markSubscriptionCanceled(event);
      break;
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
      await upsertInvoice(event);
      break;
    case "charge.refunded":
      await reverseCommissionsForCharge(event);
      break;
    case "account.updated":
      await syncConnectAccount(event);
      break;
    default:
      console.log(`[stripe-webhook] ${event.id} ${event.type} skipped (no handler)`);
      break;
  }
}

// ---------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------

function mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
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

async function upsertSubscription(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as StripeSubscriptionLoose;
  const admin = createAdminClient();
  console.log(`[stripe-webhook] ${event.id} ${event.type} start sub=${sub.id}`);

  const memberId = sub.metadata?.member_id ?? null;
  const planId = sub.metadata?.plan_id ?? null;
  const frequency = ((sub.metadata?.frequency ?? "annual") as SubscriptionFrequency);
  const enrolledBy = sub.metadata?.enrolled_by || null;

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, opco_id, plan_id, member_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  // Resolve opco_id from either the existing row, the member (via
  // metadata), or the Stripe customer as a last resort.
  let opcoId: string | null = existing?.opco_id ?? null;
  let resolvedMemberId: string | null = existing?.member_id ?? memberId;

  if (!opcoId && memberId) {
    const { data: member } = await admin
      .from("members")
      .select("opco_id")
      .eq("id", memberId)
      .maybeSingle<{ opco_id: string | null }>();
    opcoId = member?.opco_id ?? null;
  }
  if (!opcoId) {
    const customerId = stripeIdFromRef(sub.customer);
    if (customerId) {
      const { data: member } = await admin
        .from("members")
        .select("id, opco_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle<{ id: string; opco_id: string | null }>();
      opcoId = member?.opco_id ?? null;
      resolvedMemberId = resolvedMemberId ?? member?.id ?? null;
    }
  }

  if (!opcoId || !resolvedMemberId) {
    console.log(
      `[stripe-webhook] ${event.id} ${event.type} skip — could not resolve opco/member for sub=${sub.id}`,
    );
    return;
  }

  // Plan lookup: prefer metadata, fall back to invoice-derived match on
  // the sub's first item price.
  let resolvedPlanId: string | null = existing?.plan_id ?? planId;
  let resolvedFrequency: SubscriptionFrequency = frequency;
  let priceAtEnrollmentCents = 0;

  if (resolvedPlanId) {
    const { data: plan } = await admin
      .from("subscription_plans")
      .select(
        "annual_price_cents, monthly_price_cents, quarterly_price_cents",
      )
      .eq("id", resolvedPlanId)
      .maybeSingle<{
        annual_price_cents: number;
        monthly_price_cents: number;
        quarterly_price_cents: number;
      }>();
    if (plan) {
      priceAtEnrollmentCents = pickFrequencyCents(plan, resolvedFrequency);
    }
  } else {
    const firstItem = sub.items?.data?.[0];
    const priceId = firstItem?.price?.id ?? null;
    const derived = priceId
      ? await planByStripePriceId(admin, priceId)
      : null;
    if (derived) {
      resolvedPlanId = derived.plan_id;
      resolvedFrequency = derived.frequency;
      priceAtEnrollmentCents = derived.price_cents;
    }
  }

  if (!resolvedPlanId) {
    console.log(
      `[stripe-webhook] ${event.id} ${event.type} skip — no plan resolvable for sub=${sub.id}`,
    );
    return;
  }

  const baseRow = {
    opco_id: opcoId,
    member_id: resolvedMemberId,
    plan_id: resolvedPlanId,
    frequency: resolvedFrequency,
    status: mapSubscriptionStatus(sub.status),
    stripe_customer_id: stripeIdFromRef(sub.customer),
    stripe_subscription_id: sub.id,
    current_period_start: tsFromEpoch(sub.current_period_start),
    current_period_end: tsFromEpoch(sub.current_period_end),
    trial_end: tsFromEpoch(sub.trial_end),
    canceled_at: tsFromEpoch(sub.canceled_at),
    enrolled_by: enrolledBy,
    price_at_enrollment_cents: priceAtEnrollmentCents,
  };

  let subscriptionRowId = existing?.id;
  let resolution: "updated" | "inserted";

  if (existing) {
    await admin.from("subscriptions").update(baseRow).eq("id", existing.id);
    resolution = "updated";
  } else {
    const { data: inserted, error } = await admin
      .from("subscriptions")
      .insert({ ...baseRow, enrolled_at: new Date().toISOString() })
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !inserted) {
      console.error(
        `[stripe-webhook] ${event.id} ${event.type} insert failed`,
        error,
      );
      return;
    }
    subscriptionRowId = inserted.id;
    resolution = "inserted";
  }

  // Fire enrollment commission on first-create regardless of whether
  // the skeleton row was built by an earlier invoice event. The RPC
  // itself is idempotent on (kind, source_type, source_id).
  if (event.type === "customer.subscription.created" && subscriptionRowId) {
    await admin.rpc("create_cra_enrollment_commission", {
      p_subscription_id: subscriptionRowId,
    });
  }

  console.log(
    `[stripe-webhook] ${event.id} ${event.type} done sub=${sub.id} row=${subscriptionRowId} ${resolution}`,
  );
}

async function markSubscriptionCanceled(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as StripeSubscriptionLoose;
  const admin = createAdminClient();
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} start sub=${sub.id}`,
  );
  const { data, error } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .select("id");
  const count = (data ?? []).length;
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} done sub=${sub.id} rows_updated=${count}${error ? ` error=${error.message}` : ""}`,
  );
}

// ---------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------

interface ResolvedSub {
  id: string;
  opco_id: string;
  member_id: string;
}

async function resolveSubscriptionRowForInvoice(
  admin: SupabaseAdmin,
  inv: StripeInvoiceLoose,
  eventId: string,
): Promise<ResolvedSub | null> {
  const stripeSubId = stripeIdFromRef(inv.subscription);
  if (!stripeSubId) return null;

  // 1. Already present?
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, opco_id, member_id")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle<ResolvedSub>();
  if (existing) {
    return existing;
  }

  // 2. Stripe delivered the invoice before the subscription event.
  //    Derive the member from the Stripe customer, and the plan from
  //    the invoice's first line item price.
  const customerId = stripeIdFromRef(inv.customer);
  if (!customerId) {
    console.log(
      `[stripe-webhook] ${eventId} skeleton skip — no customer on inv=${inv.id}`,
    );
    return null;
  }

  const { data: member } = await admin
    .from("members")
    .select("id, opco_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string; opco_id: string | null }>();
  if (!member?.opco_id) {
    console.log(
      `[stripe-webhook] ${eventId} skeleton skip — no member for customer=${customerId}`,
    );
    return null;
  }

  const firstLine = inv.lines?.data?.[0];
  // `price` was a top-level field on invoice line items in older Stripe
  // API versions; recent versions move it under `pricing.price_details`.
  // We read both so the handler works across SDK upgrades.
  const priceId = firstLine
    ? ((firstLine as unknown as {
        price?: { id?: string };
        pricing?: { price_details?: { price?: string } };
      }).price?.id ??
        (firstLine as unknown as {
          pricing?: { price_details?: { price?: string } };
        }).pricing?.price_details?.price ??
        null)
    : null;
  if (!priceId) {
    console.log(
      `[stripe-webhook] ${eventId} skeleton skip — no price on inv=${inv.id}`,
    );
    return null;
  }

  const derived = await planByStripePriceId(admin, priceId);
  if (!derived) {
    console.log(
      `[stripe-webhook] ${eventId} skeleton skip — unknown price ${priceId}`,
    );
    return null;
  }

  const { data: inserted, error } = await admin
    .from("subscriptions")
    .insert({
      opco_id: member.opco_id,
      member_id: member.id,
      plan_id: derived.plan_id,
      frequency: derived.frequency,
      status: "pending",
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubId,
      price_at_enrollment_cents: derived.price_cents,
      enrolled_at: new Date().toISOString(),
      notes:
        "Skeleton created from invoice webhook (out-of-order delivery). Filled in when customer.subscription.created arrives.",
    })
    .select("id, opco_id, member_id")
    .maybeSingle<ResolvedSub>();

  if (error || !inserted) {
    console.error(
      `[stripe-webhook] ${eventId} skeleton insert failed`,
      error,
    );
    return null;
  }

  console.log(
    `[stripe-webhook] ${eventId} skeleton subscription created row=${inserted.id} sub=${stripeSubId}`,
  );
  return inserted;
}

function invoiceKindFromBillingReason(
  reason: string | null | undefined,
  hasSubscription: boolean,
): InvoiceKind {
  if (!hasSubscription) return "manual";
  switch (reason) {
    case "subscription_create":
      return "subscription_initial";
    case "subscription_cycle":
      return "subscription_renewal";
    case "subscription_update":
      return "subscription_upgrade";
    default:
      return "subscription_renewal";
  }
}

function invoiceStatusFromEvent(
  eventType: string,
  inv: StripeInvoiceLoose,
): InvoiceStatus {
  if (eventType === "invoice.paid") return "paid";
  if (eventType === "invoice.voided") return "void";
  if (eventType === "invoice.payment_failed") {
    return inv.status === "uncollectible" ? "uncollectible" : "open";
  }
  if (eventType === "invoice.finalized") return "open";
  // invoice.created (or anything else) — trust the invoice's own status.
  const s = inv.status;
  if (s === "paid") return "paid";
  if (s === "void") return "void";
  if (s === "uncollectible") return "uncollectible";
  if (s === "open") return "open";
  return "draft";
}

async function upsertInvoice(event: Stripe.Event): Promise<void> {
  const inv = event.data.object as StripeInvoiceLoose;
  const admin = createAdminClient();
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} start inv=${inv.id}`,
  );

  const subRow = await resolveSubscriptionRowForInvoice(admin, inv, event.id);
  const opcoId = subRow?.opco_id ?? (await opcoIdFromCustomer(admin, inv));
  if (!opcoId) {
    console.log(
      `[stripe-webhook] ${event.id} ${event.type} skip inv=${inv.id} — no opco resolvable`,
    );
    return;
  }

  const status = invoiceStatusFromEvent(event.type, inv);
  const hasSubscription = Boolean(inv.subscription);
  const kind = invoiceKindFromBillingReason(inv.billing_reason, hasSubscription);

  const row = {
    opco_id: opcoId,
    member_id: subRow?.member_id ?? (await memberIdFromCustomer(admin, inv)),
    subscription_id: subRow?.id ?? null,
    stripe_invoice_id: inv.id,
    kind,
    status,
    subtotal_cents: inv.subtotal ?? 0,
    tax_cents: inv.tax ?? 0,
    total_cents: inv.total ?? 0,
    amount_paid_cents: inv.amount_paid ?? 0,
    amount_remaining_cents: inv.amount_remaining ?? 0,
    currency: inv.currency ?? "usd",
    issued_at: tsFromEpoch(inv.created),
    paid_at:
      status === "paid" && inv.status_transitions?.paid_at
        ? tsFromEpoch(inv.status_transitions.paid_at)
        : null,
    due_at: tsFromEpoch(inv.due_date),
    hosted_invoice_url: inv.hosted_invoice_url ?? null,
    pdf_url: inv.invoice_pdf ?? null,
  };

  const { data: existing } = await admin
    .from("invoices")
    .select("id")
    .eq("stripe_invoice_id", inv.id ?? "")
    .maybeSingle<{ id: string }>();

  let invoiceRowId = existing?.id;
  let resolution: "updated" | "inserted";
  if (existing) {
    const { error } = await admin
      .from("invoices")
      .update(row)
      .eq("id", existing.id);
    if (error) {
      console.error(
        `[stripe-webhook] ${event.id} ${event.type} update failed`,
        error,
      );
      return;
    }
    resolution = "updated";
  } else {
    const { data: inserted, error } = await admin
      .from("invoices")
      .insert(row)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !inserted) {
      console.error(
        `[stripe-webhook] ${event.id} ${event.type} insert failed`,
        error,
      );
      return;
    }
    invoiceRowId = inserted.id;
    resolution = "inserted";
  }

  // CRA renewal residual fires on paid renewal / upgrade only.
  if (
    status === "paid" &&
    invoiceRowId &&
    subRow?.id &&
    (kind === "subscription_renewal" || kind === "subscription_upgrade")
  ) {
    await admin.rpc("create_cra_renewal_residual", {
      p_subscription_id: subRow.id,
      p_invoice_id: invoiceRowId,
    });
  }

  // Failed payments flip the subscription into past_due.
  if (event.type === "invoice.payment_failed" && subRow?.id) {
    await admin
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("id", subRow.id);
  }

  console.log(
    `[stripe-webhook] ${event.id} ${event.type} done inv=${inv.id} row=${invoiceRowId} ${resolution} sub_row=${subRow?.id ?? "none"} status=${status} kind=${kind}`,
  );
}

// ---------------------------------------------------------------
// Charges + Connect accounts
// ---------------------------------------------------------------

async function reverseCommissionsForCharge(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as StripeChargeLoose;
  const admin = createAdminClient();
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} start charge=${charge.id}`,
  );

  const stripeInvoiceId = stripeIdFromRef(charge.invoice);
  if (!stripeInvoiceId) {
    console.log(
      `[stripe-webhook] ${event.id} ${event.type} skip — no invoice on charge=${charge.id}`,
    );
    return;
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, total_cents")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle<{ id: string; total_cents: number }>();
  if (!invoice) {
    console.log(
      `[stripe-webhook] ${event.id} ${event.type} skip — no invoice row for ${stripeInvoiceId}`,
    );
    return;
  }

  const { data, error } = await admin
    .from("commissions")
    .update({
      status: "reversed",
      reversal_reason: `Refund on charge ${charge.id}`,
    })
    .eq("source_type", "invoice")
    .eq("source_id", invoice.id)
    .in("status", ["pending", "approved", "paid"])
    .select("id");
  const count = (data ?? []).length;
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} done charge=${charge.id} invoice_row=${invoice.id} reversed=${count}${error ? ` error=${error.message}` : ""}`,
  );
}

async function syncConnectAccount(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  const admin = createAdminClient();
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} start account=${account.id}`,
  );

  const { data: row } = await admin
    .from("opco_stripe_accounts")
    .select("id, opco_id")
    .eq("stripe_account_id", account.id)
    .maybeSingle<{ id: string; opco_id: string }>();
  if (!row) {
    console.log(
      `[stripe-webhook] ${event.id} ${event.type} skip — no opco row for ${account.id}`,
    );
    return;
  }

  const { error } = await admin
    .from("opco_stripe_accounts")
    .update({
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      disabled_reason: account.requirements?.disabled_reason
        ? String(account.requirements.disabled_reason)
        : null,
      onboarding_completed_at:
        account.details_submitted && account.charges_enabled
          ? new Date().toISOString()
          : null,
    })
    .eq("id", row.id);
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} done account=${account.id} charges=${account.charges_enabled} payouts=${account.payouts_enabled}${error ? ` error=${error.message}` : ""}`,
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function stripeIdFromRef(
  ref: string | { id?: string } | null | undefined,
): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return ref.id ?? null;
}

function tsFromEpoch(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function pickFrequencyCents(
  plan: {
    annual_price_cents: number;
    monthly_price_cents: number;
    quarterly_price_cents: number;
  },
  frequency: SubscriptionFrequency,
): number {
  return frequency === "annual"
    ? plan.annual_price_cents
    : frequency === "monthly"
      ? plan.monthly_price_cents
      : plan.quarterly_price_cents;
}

async function planByStripePriceId(
  admin: SupabaseAdmin,
  priceId: string,
): Promise<{
  plan_id: string;
  frequency: SubscriptionFrequency;
  price_cents: number;
} | null> {
  const { data: plan } = await admin
    .from("subscription_plans")
    .select(
      "id, annual_price_cents, monthly_price_cents, quarterly_price_cents, stripe_price_annual_id, stripe_price_monthly_id, stripe_price_quarterly_id",
    )
    .or(
      `stripe_price_annual_id.eq.${priceId},stripe_price_monthly_id.eq.${priceId},stripe_price_quarterly_id.eq.${priceId}`,
    )
    .maybeSingle<{
      id: string;
      annual_price_cents: number;
      monthly_price_cents: number;
      quarterly_price_cents: number;
      stripe_price_annual_id: string | null;
      stripe_price_monthly_id: string | null;
      stripe_price_quarterly_id: string | null;
    }>();
  if (!plan) return null;
  const frequency: SubscriptionFrequency =
    plan.stripe_price_annual_id === priceId
      ? "annual"
      : plan.stripe_price_monthly_id === priceId
        ? "monthly"
        : "quarterly";
  return {
    plan_id: plan.id,
    frequency,
    price_cents: pickFrequencyCents(plan, frequency),
  };
}

async function memberIdFromCustomer(
  admin: SupabaseAdmin,
  inv: StripeInvoiceLoose,
): Promise<string | null> {
  const customerId = stripeIdFromRef(inv.customer);
  if (!customerId) return null;
  const { data } = await admin
    .from("members")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function opcoIdFromCustomer(
  admin: SupabaseAdmin,
  inv: StripeInvoiceLoose,
): Promise<string | null> {
  const customerId = stripeIdFromRef(inv.customer);
  if (!customerId) return null;
  const { data } = await admin
    .from("members")
    .select("opco_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ opco_id: string | null }>();
  return data?.opco_id ?? null;
}
