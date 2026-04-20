"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StripeProductsInitializer() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/stripe/initialize-products", {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        created?: string[];
        skipped?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Initialize failed");
      setStatus(
        `Created ${json.created?.length ?? 0} · Skipped ${json.skipped?.length ?? 0}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialize failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={pending} variant="accent">
        {pending ? "Initializing…" : "Initialize Stripe products"}
      </Button>
      {status ? (
        <span className="text-xs text-brand-success">{status}</span>
      ) : null}
      {error ? (
        <span className="text-xs text-brand-error">{error}</span>
      ) : null}
    </div>
  );
}
