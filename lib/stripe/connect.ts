import { getStripe, stripeIsConfigured } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import type { Organization, OpcoStripeAccount } from "@/lib/types";

const DEFAULT_REFRESH_URL = (opcoId: string) =>
  `${getSiteUrl()}/settings/stripe?refresh=${opcoId}`;
const DEFAULT_RETURN_URL = (opcoId: string) =>
  `${getSiteUrl()}/settings/stripe?return=${opcoId}`;

export async function createOpcoConnectAccount(opcoId: string): Promise<string> {
  if (!stripeIsConfigured()) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", opcoId)
    .maybeSingle<Organization>();
  if (!org) throw new Error("Organization not found");

  const { data: existing } = await admin
    .from("opco_stripe_accounts")
    .select("*")
    .eq("opco_id", opcoId)
    .maybeSingle<OpcoStripeAccount>();

  if (existing?.stripe_account_id) {
    return existing.stripe_account_id;
  }

  const account = await stripe.accounts.create({
    type: "standard",
    email: org.email ?? undefined,
    business_profile: {
      name: org.name,
      support_email: org.email ?? undefined,
      support_phone: org.phone ?? undefined,
    },
    metadata: { opco_id: opcoId, opco_slug: org.slug },
  });

  await admin.from("opco_stripe_accounts").upsert(
    {
      opco_id: opcoId,
      stripe_account_id: account.id,
      account_type: "standard",
    },
    { onConflict: "opco_id" },
  );

  return account.id;
}

export async function getOnboardingLink(opcoId: string): Promise<string> {
  if (!stripeIsConfigured()) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("opco_stripe_accounts")
    .select("stripe_account_id")
    .eq("opco_id", opcoId)
    .maybeSingle<{ stripe_account_id: string | null }>();

  const accountId =
    row?.stripe_account_id ?? (await createOpcoConnectAccount(opcoId));

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: DEFAULT_REFRESH_URL(opcoId),
    return_url: DEFAULT_RETURN_URL(opcoId),
    type: "account_onboarding",
  });
  return link.url;
}

export async function syncOpcoAccountStatus(opcoId: string): Promise<{
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
}> {
  if (!stripeIsConfigured()) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("opco_stripe_accounts")
    .select("stripe_account_id")
    .eq("opco_id", opcoId)
    .maybeSingle<{ stripe_account_id: string | null }>();

  if (!row?.stripe_account_id) {
    throw new Error("No Stripe Connect account for this OpCo yet.");
  }

  const account = await stripe.accounts.retrieve(row.stripe_account_id);
  const update = {
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
  };

  await admin
    .from("opco_stripe_accounts")
    .update(update)
    .eq("opco_id", opcoId);

  return {
    charges_enabled: update.charges_enabled,
    payouts_enabled: update.payouts_enabled,
    details_submitted: update.details_submitted,
    disabled_reason: update.disabled_reason,
  };
}
