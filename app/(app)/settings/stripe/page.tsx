import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageStripeSettings } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { stripeIsConfigured } from "@/lib/stripe/client";
import type { Organization, OpcoStripeAccount, SubscriptionPlan } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StripeProductsInitializer } from "./products-initializer";
import { ConnectAccountsPanel } from "./connect-panel";

export default async function StripeSettingsPage() {
  const session = await requireSession();
  if (!canManageStripeSettings(session.roles)) redirect("/settings/profile");
  const supabase = await createClient();

  const [{ data: plansData }, { data: opcosData }, { data: accountsData }] =
    await Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("tier_level", { ascending: true }),
      supabase
        .from("organizations")
        .select("*")
        .eq("type", "opco")
        .order("name", { ascending: true }),
      supabase.from("opco_stripe_accounts").select("*"),
    ]);
  const plans = (plansData ?? []) as SubscriptionPlan[];
  const opcos = (opcosData ?? []) as Organization[];
  const accounts = (accountsData ?? []) as OpcoStripeAccount[];
  const accountByOpco = Object.fromEntries(
    accounts.map((a) => [a.opco_id, a]),
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = appUrl ? `${appUrl}/api/webhooks/stripe` : "/api/webhooks/stripe";

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono">Phase 5 · Monetization</p>
        <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
          Stripe settings
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          Initialize products, wire the webhook endpoint, and onboard each
          OpCo&apos;s Connect account.
        </p>
      </div>

      {!stripeIsConfigured() ? (
        <div className="rounded-md border border-brand-warn/40 bg-brand-warn/5 p-4 text-sm text-brand-warn">
          <p className="font-medium">STRIPE_SECRET_KEY is not set.</p>
          <p className="mt-1">
            Add it to Vercel env vars. The app reads the seeded data fine
            without it; every Stripe call errors out until you fix this.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <p className="label-mono">Webhook endpoint</p>
          <CardTitle>Register this URL in Stripe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <code className="block rounded bg-brand-bg px-3 py-2 text-xs text-brand-primary">
            {webhookUrl}
          </code>
          <p className="text-xs text-brand-muted">
            Stripe Dashboard → Developers → Webhooks → Add endpoint. Listen
            for: <code>invoice.paid</code>, <code>invoice.payment_failed</code>,
            {" "}<code>customer.subscription.created|updated|deleted</code>,
            {" "}<code>customer.subscription.trial_will_end</code>,
            {" "}<code>charge.refunded</code>, <code>account.updated</code>.
            Copy the signing secret and set
            {" "}<code>STRIPE_WEBHOOK_SECRET</code> in Vercel.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="label-mono">Subscription products</p>
          <CardTitle>Plan ↔ Stripe linkage</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-brand-border">
            {plans.map((p) => {
              const ready = Boolean(
                p.stripe_product_id &&
                  p.stripe_price_annual_id &&
                  p.stripe_price_monthly_id &&
                  p.stripe_price_quarterly_id,
              );
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-serif text-base text-brand-primary">
                      {p.name}
                    </p>
                    <p className="text-xs text-brand-muted">
                      Tier {p.tier_level} · ${(p.annual_price_cents / 100).toFixed(0)}/yr
                    </p>
                  </div>
                  <Badge variant={ready ? "success" : "warn"}>
                    {ready ? "Ready" : "Not initialized"}
                  </Badge>
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <StripeProductsInitializer />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="label-mono">Connect accounts</p>
          <CardTitle>Per-OpCo Stripe onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectAccountsPanel
            opcos={opcos}
            accountByOpco={accountByOpco}
          />
        </CardContent>
      </Card>
    </div>
  );
}
