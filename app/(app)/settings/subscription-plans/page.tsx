import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageSubscriptionPlans } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionPlan } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents, formatPercentRate } from "@/lib/money";

export default async function SubscriptionPlansPage() {
  const session = await requireSession();
  if (!canManageSubscriptionPlans(session.roles)) redirect("/settings/profile");
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("tier_level", { ascending: true });
  const plans = (data ?? []) as SubscriptionPlan[];

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono">Phase 5 · Monetization</p>
        <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
          Subscription plans
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          Umbra&apos;s 4 tiers and their Stripe wiring. Editable in a future
          phase — today this is a read-only operator view.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="label-mono">Tier {p.tier_level}</p>
                <Badge variant={p.active ? "success" : "outline"}>
                  {p.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <Tile label="Annual" value={formatCents(p.annual_price_cents, { decimals: 0 })} />
                <Tile label="Quarterly" value={formatCents(p.quarterly_price_cents, { decimals: 0 })} />
                <Tile label="Monthly" value={formatCents(p.monthly_price_cents, { decimals: 0 })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Tile
                  label="CRA enrollment"
                  value={formatCents(p.cra_enrollment_commission_cents, { decimals: 0 })}
                />
                <Tile
                  label="CRA renewal residual"
                  value={formatPercentRate(p.cra_renewal_residual_pct)}
                />
              </div>
              <div>
                <p className="label-mono">Features</p>
                <ul className="mt-2 space-y-1 text-xs text-brand-muted">
                  {p.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>
              <div className="pt-2">
                <p className="label-mono">Stripe IDs</p>
                <dl className="mt-1 space-y-0.5 font-mono text-[11px] text-brand-muted">
                  <dd>product · {p.stripe_product_id ?? "—"}</dd>
                  <dd>annual · {p.stripe_price_annual_id ?? "—"}</dd>
                  <dd>quarterly · {p.stripe_price_quarterly_id ?? "—"}</dd>
                  <dd>monthly · {p.stripe_price_monthly_id ?? "—"}</dd>
                </dl>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-brand-border bg-brand-bg/50 p-2">
      <p className="label-mono">{label}</p>
      <p className="metric-figure mt-1 text-lg text-brand-primary">{value}</p>
    </div>
  );
}
