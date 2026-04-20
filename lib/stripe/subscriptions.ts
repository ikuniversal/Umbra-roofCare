import { getStripe, stripeIsConfigured } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Member,
  SubscriptionFrequency,
  SubscriptionPlan,
} from "@/lib/types";

function priceIdFor(
  plan: SubscriptionPlan,
  frequency: SubscriptionFrequency,
): string | null {
  return frequency === "annual"
    ? plan.stripe_price_annual_id
    : frequency === "monthly"
      ? plan.stripe_price_monthly_id
      : plan.stripe_price_quarterly_id;
}

export async function ensureStripeCustomer(memberId: string): Promise<string> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle<Member & { stripe_customer_id: string | null }>();
  if (!member) throw new Error("Member not found");
  if (member.stripe_customer_id) return member.stripe_customer_id;

  const customer = await stripe.customers.create({
    name: `${member.first_name} ${member.last_name}`,
    email: member.email ?? undefined,
    phone: member.phone ?? undefined,
    metadata: { member_id: member.id },
  });

  await admin
    .from("members")
    .update({ stripe_customer_id: customer.id })
    .eq("id", memberId);

  return customer.id;
}

export async function createCheckoutSession(input: {
  memberId: string;
  planId: string;
  frequency: SubscriptionFrequency;
  successUrl: string;
  cancelUrl: string;
  enrolledBy: string | null;
}): Promise<{ url: string; sessionId: string }> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("id", input.planId)
    .maybeSingle<SubscriptionPlan>();
  if (!plan) throw new Error("Plan not found");

  const priceId = priceIdFor(plan, input.frequency);
  if (!priceId) {
    throw new Error(
      "Stripe products not initialized. Run 'Initialize Stripe Products' first.",
    );
  }

  const customerId = await ensureStripeCustomer(input.memberId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    subscription_data: {
      metadata: {
        member_id: input.memberId,
        plan_id: input.planId,
        frequency: input.frequency,
        enrolled_by: input.enrolledBy ?? "",
      },
    },
    metadata: {
      member_id: input.memberId,
      plan_id: input.planId,
      frequency: input.frequency,
      enrolled_by: input.enrolledBy ?? "",
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

export async function createPortalSession(input: {
  memberId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("stripe_customer_id")
    .eq("id", input.memberId)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (!member?.stripe_customer_id) {
    throw new Error("Member has no Stripe customer record yet.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: member.stripe_customer_id,
    return_url: input.returnUrl,
  });
  return { url: session.url };
}

export async function upgradeSubscription(input: {
  subscriptionId: string;
  newPlanId: string;
  newFrequency: SubscriptionFrequency;
}): Promise<void> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*, subscription_plans:plan_id(*)")
    .eq("id", input.subscriptionId)
    .maybeSingle<{
      id: string;
      stripe_subscription_id: string | null;
      plan_id: string;
    }>();

  if (!sub?.stripe_subscription_id) {
    throw new Error("Subscription has no Stripe link.");
  }

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("id", input.newPlanId)
    .maybeSingle<SubscriptionPlan>();
  if (!plan) throw new Error("Target plan not found");

  const priceId = priceIdFor(plan, input.newFrequency);
  if (!priceId) {
    throw new Error("Target plan has no Stripe price for that frequency.");
  }

  const stripeSub = await stripe.subscriptions.retrieve(
    sub.stripe_subscription_id,
  );
  const itemId = stripeSub.items.data[0]?.id;
  if (!itemId) throw new Error("Stripe subscription has no items");

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: "create_prorations",
    metadata: {
      plan_id: input.newPlanId,
      frequency: input.newFrequency,
    },
  });

  await admin
    .from("subscriptions")
    .update({ plan_id: input.newPlanId, frequency: input.newFrequency })
    .eq("id", input.subscriptionId);
}

export async function cancelSubscription(input: {
  subscriptionId: string;
  atPeriodEnd: boolean;
  reason?: string;
}): Promise<void> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id")
    .eq("id", input.subscriptionId)
    .maybeSingle<{ id: string; stripe_subscription_id: string | null }>();
  if (!sub?.stripe_subscription_id) {
    throw new Error("Subscription has no Stripe link.");
  }

  if (input.atPeriodEnd) {
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: input.reason ? { cancellation_reason: input.reason } : {},
    });
  } else {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  }

  await admin
    .from("subscriptions")
    .update({
      cancellation_reason: input.reason ?? null,
      status: input.atPeriodEnd ? "active" : "canceled",
      canceled_at: input.atPeriodEnd ? null : new Date().toISOString(),
    })
    .eq("id", input.subscriptionId);
}

export async function pauseSubscription(subscriptionId: string): Promise<void> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("id", subscriptionId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();
  if (!sub?.stripe_subscription_id) throw new Error("No Stripe link");
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    pause_collection: { behavior: "void" },
  });
  await admin.from("subscriptions").update({ status: "paused" }).eq("id", subscriptionId);
}

export async function resumeSubscription(subscriptionId: string): Promise<void> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("id", subscriptionId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();
  if (!sub?.stripe_subscription_id) throw new Error("No Stripe link");
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    pause_collection: "",
  });
  await admin.from("subscriptions").update({ status: "active" }).eq("id", subscriptionId);
}
