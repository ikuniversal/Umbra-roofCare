"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type {
  Subscription,
  SubscriptionFrequency,
  SubscriptionPlan,
} from "@/lib/types";
import { formatCents } from "@/lib/money";

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

export function SubscriptionActions({
  memberId,
  subscription,
  plans,
}: {
  memberId: string;
  subscription: Subscription;
  plans: SubscriptionPlan[];
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const openPortal = async () => {
    setPending("portal");
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Portal failed");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
      setPending(null);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" onClick={openPortal} disabled={pending !== null}>
        {pending === "portal" ? "Opening…" : "Manage payment method"}
      </Button>
      <ChangePlanDialog subscription={subscription} plans={plans} />
      <CancelDialog subscription={subscription} />
      {error ? (
        <span className="w-full text-xs text-brand-error">{error}</span>
      ) : null}
    </div>
  );
}

function ChangePlanDialog({
  subscription,
  plans,
}: {
  subscription: Subscription;
  plans: SubscriptionPlan[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [planId, setPlanId] = React.useState(subscription.plan_id);
  const [frequency, setFrequency] = React.useState<SubscriptionFrequency>(
    subscription.frequency,
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription_id: subscription.id,
          plan_id: planId,
          frequency,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Change failed");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Change plan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(v) =>
                setFrequency(v as SubscriptionFrequency)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {plan ? (
            <p className="rounded-md border border-brand-border bg-brand-bg/50 p-3 text-sm">
              New price:{" "}
              <span className="metric-figure text-base text-brand-primary">
                {formatCents(frequencyCents(plan, frequency))}
              </span>{" "}
              · Stripe will proration mid-cycle charges or credits.
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-brand-error">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Submitting…" : "Confirm change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ subscription }: { subscription: Subscription }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [atPeriodEnd, setAtPeriodEnd] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription_id: subscription.id,
          at_period_end: atPeriodEnd,
          reason,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Cancel failed");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Cancel subscription</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="too_expensive">Too expensive</SelectItem>
                <SelectItem value="missing_features">Missing features</SelectItem>
                <SelectItem value="switched_service">Switched service</SelectItem>
                <SelectItem value="sold_home">Sold home</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timing</Label>
            <Select
              value={atPeriodEnd ? "period_end" : "immediate"}
              onValueChange={(v) => setAtPeriodEnd(v === "period_end")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="period_end">
                  End of current period
                </SelectItem>
                <SelectItem value="immediate">Immediately</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={reason === "other" ? reason : ""}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {error ? (
            <p className="text-xs text-brand-error">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep subscription
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Canceling…" : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
