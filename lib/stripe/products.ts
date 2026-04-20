import { getStripe, stripeIsConfigured } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan } from "@/lib/types";

export interface InitializeResult {
  plans: {
    code: string;
    name: string;
    stripe_product_id: string;
    stripe_price_annual_id: string;
    stripe_price_monthly_id: string;
    stripe_price_quarterly_id: string;
  }[];
  skipped: string[];
}

// Idempotently ensure every row in subscription_plans has a corresponding
// Stripe Product + 3 Prices (annual / monthly / quarterly). Safe to re-run;
// plans that already have all 4 IDs populated are skipped.
//
// Uses the service-role Supabase client so a super admin can trigger this
// even if their session lacks direct write access to the plans table.
export async function ensureProductsExist(): Promise<InitializeResult> {
  if (!stripeIsConfigured()) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to the Vercel env vars first.",
    );
  }

  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: plansData, error } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("active", true)
    .order("tier_level", { ascending: true });

  if (error) throw new Error(error.message);
  const plans = (plansData ?? []) as SubscriptionPlan[];

  const created: InitializeResult["plans"] = [];
  const skipped: string[] = [];

  for (const plan of plans) {
    const alreadyDone =
      plan.stripe_product_id &&
      plan.stripe_price_annual_id &&
      plan.stripe_price_monthly_id &&
      plan.stripe_price_quarterly_id;

    if (alreadyDone) {
      skipped.push(plan.code);
      continue;
    }

    let productId = plan.stripe_product_id;
    if (!productId) {
      const product = await stripe.products.create({
        name: `Umbra RoofCare · ${plan.name}`,
        description: `${plan.name} membership tier`,
        metadata: { plan_code: plan.code, tier_level: String(plan.tier_level) },
      });
      productId = product.id;
    }

    const ensurePrice = async (
      existing: string | null,
      amountCents: number,
      interval: "year" | "month",
      intervalCount = 1,
      nickname?: string,
    ) => {
      if (existing) return existing;
      const price = await stripe.prices.create({
        product: productId!,
        unit_amount: amountCents,
        currency: "usd",
        recurring: { interval, interval_count: intervalCount },
        nickname,
        metadata: { plan_code: plan.code },
      });
      return price.id;
    };

    const annualId = await ensurePrice(
      plan.stripe_price_annual_id,
      plan.annual_price_cents,
      "year",
      1,
      `${plan.name} · Annual`,
    );
    const monthlyId = await ensurePrice(
      plan.stripe_price_monthly_id,
      plan.monthly_price_cents,
      "month",
      1,
      `${plan.name} · Monthly`,
    );
    const quarterlyId = await ensurePrice(
      plan.stripe_price_quarterly_id,
      plan.quarterly_price_cents,
      "month",
      3,
      `${plan.name} · Quarterly`,
    );

    const { error: updateErr } = await admin
      .from("subscription_plans")
      .update({
        stripe_product_id: productId,
        stripe_price_annual_id: annualId,
        stripe_price_monthly_id: monthlyId,
        stripe_price_quarterly_id: quarterlyId,
      })
      .eq("id", plan.id);

    if (updateErr) throw new Error(updateErr.message);

    created.push({
      code: plan.code,
      name: plan.name,
      stripe_product_id: productId!,
      stripe_price_annual_id: annualId,
      stripe_price_monthly_id: monthlyId,
      stripe_price_quarterly_id: quarterlyId,
    });
  }

  return { plans: created, skipped };
}
