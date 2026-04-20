"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import type { SubscriptionFrequency, SubscriptionPlan } from "@/lib/types";

type Step = "pick_tier" | "pick_frequency" | "review";

const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  annual: "Annual",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

function frequencyCents(
  plan: SubscriptionPlan,
  frequency: SubscriptionFrequency,
): number {
  return frequency === "annual"
    ? plan.annual_price_cents
    : frequency === "monthly"
      ? plan.monthly_price_cents
      : plan.quarterly_price_cents;
}

function frequencyNote(frequency: SubscriptionFrequency): string {
  return frequency === "annual"
    ? "Billed once per year"
    : frequency === "monthly"
      ? "Billed every month (+15% vs annual)"
      : "Billed every 3 months (+8% vs annual)";
}

export function EnrollmentFlow({
  memberId,
  plans,
  hasCustomer,
}: {
  memberId: string;
  plans: SubscriptionPlan[];
  hasCustomer: boolean;
}) {
  const [step, setStep] = React.useState<Step>("pick_tier");
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);
  const [frequency, setFrequency] = React.useState<SubscriptionFrequency>("annual");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const startCheckout = async () => {
    if (!selectedPlan) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          plan_id: selectedPlan.id,
          frequency,
        }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Checkout failed");
      }
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setPending(false);
    }
  };

  if (plans.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        No active plans. A super admin must seed and initialize Stripe
        products first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {step === "pick_tier" ? (
        <section className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedPlanId(p.id);
                setStep("pick_frequency");
              }}
              className={cn(
                "rounded-md border border-brand-border bg-brand-card p-4 text-left transition-colors hover:border-brand-accent",
                selectedPlanId === p.id && "border-brand-accent",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="label-mono">Tier {p.tier_level}</p>
                {p.stripe_price_annual_id ? null : (
                  <span className="label-mono !text-brand-warn">
                    Not initialized
                  </span>
                )}
              </div>
              <h3 className="mt-1 font-serif text-2xl text-brand-primary">
                {p.name}
              </h3>
              <p className="metric-figure mt-2 text-3xl text-brand-primary">
                {formatCents(p.annual_price_cents, { decimals: 0 })}
                <span className="ml-1 text-xs text-brand-muted">/ year</span>
              </p>
              <ul className="mt-3 space-y-1 text-xs text-brand-muted">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-[2px] h-3 w-3 text-brand-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </section>
      ) : null}

      {step === "pick_frequency" && selectedPlan ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-mono">Selected</p>
              <p className="font-serif text-2xl text-brand-primary">
                {selectedPlan.name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("pick_tier")}
            >
              Change tier
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(["annual", "quarterly", "monthly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={cn(
                  "rounded-md border border-brand-border bg-brand-card p-4 text-left transition-colors hover:border-brand-accent",
                  frequency === f && "border-brand-accent",
                )}
              >
                <p className="label-mono">{FREQUENCY_LABELS[f]}</p>
                <p className="metric-figure mt-2 text-2xl text-brand-primary">
                  {formatCents(frequencyCents(selectedPlan, f), { decimals: 0 })}
                </p>
                <p className="mt-1 text-[11px] text-brand-muted">
                  {frequencyNote(f)}
                </p>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("pick_tier")}>
              Back
            </Button>
            <Button variant="accent" onClick={() => setStep("review")}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {step === "review" && selectedPlan ? (
        <section className="space-y-4">
          <div className="rounded-md border border-brand-border bg-brand-card p-5">
            <p className="label-mono">Review</p>
            <p className="mt-1 font-serif text-2xl text-brand-primary">
              {selectedPlan.name} · {FREQUENCY_LABELS[frequency]}
            </p>
            <p className="metric-figure mt-2 text-3xl text-brand-primary">
              {formatCents(frequencyCents(selectedPlan, frequency))}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              {frequencyNote(frequency)}
            </p>
          </div>
          {!hasCustomer ? (
            <p className="rounded-md border border-brand-warn/30 bg-brand-warn/5 px-3 py-2 text-xs text-brand-warn">
              A Stripe customer will be created on checkout. No card is
              stored until the member completes payment.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-brand-error/30 bg-brand-error/5 px-3 py-2 text-xs text-brand-error">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("pick_frequency")}>
              Back
            </Button>
            <Button
              variant="accent"
              onClick={startCheckout}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening checkout…
                </>
              ) : (
                "Collect payment"
              )}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
