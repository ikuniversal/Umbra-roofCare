"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Organization, OpcoStripeAccount } from "@/lib/types";

interface Props {
  opcos: Organization[];
  accountByOpco: Record<string, OpcoStripeAccount>;
}

export function ConnectAccountsPanel({ opcos, accountByOpco }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const call = async (opcoId: string, action: "create" | "onboarding_link" | "sync") => {
    setPending(`${opcoId}:${action}`);
    setError(null);
    try {
      const res = await fetch("/api/stripe/sync-opco-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opco_id: opcoId, action }),
      });
      const json = (await res.json()) as {
        url?: string;
        charges_enabled?: boolean;
        payouts_enabled?: boolean;
        stripe_account_id?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      if (action === "onboarding_link" && json.url) {
        window.open(json.url, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(null);
    }
  };

  if (opcos.length === 0) {
    return <p className="text-sm text-brand-muted">No OpCos yet.</p>;
  }

  return (
    <div className="space-y-3">
      {opcos.map((o) => {
        const acc = accountByOpco[o.id];
        const hasAccount = Boolean(acc?.stripe_account_id);
        return (
          <div
            key={o.id}
            className="rounded-md border border-brand-border bg-brand-card p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-serif text-base text-brand-primary">
                  {o.name}
                </p>
                <p className="text-xs text-brand-muted">
                  {o.state ?? "—"} · {o.slug}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={acc?.charges_enabled ? "success" : "outline"}>
                  Charges {acc?.charges_enabled ? "on" : "off"}
                </Badge>
                <Badge variant={acc?.payouts_enabled ? "success" : "outline"}>
                  Payouts {acc?.payouts_enabled ? "on" : "off"}
                </Badge>
                {acc?.disabled_reason ? (
                  <Badge variant="error">{acc.disabled_reason}</Badge>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!hasAccount ? (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => call(o.id, "create")}
                  disabled={pending !== null}
                >
                  {pending === `${o.id}:create`
                    ? "Creating…"
                    : "Create Connect account"}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => call(o.id, "onboarding_link")}
                    disabled={pending !== null}
                  >
                    {pending === `${o.id}:onboarding_link`
                      ? "Opening…"
                      : "Send onboarding link"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => call(o.id, "sync")}
                    disabled={pending !== null}
                  >
                    {pending === `${o.id}:sync` ? "Syncing…" : "Sync status"}
                  </Button>
                </>
              )}
            </div>
            {acc?.stripe_account_id ? (
              <p className="mt-2 font-mono text-[11px] text-brand-muted">
                {acc.stripe_account_id}
              </p>
            ) : null}
          </div>
        );
      })}
      {error ? (
        <p className="text-xs text-brand-error">{error}</p>
      ) : null}
    </div>
  );
}
