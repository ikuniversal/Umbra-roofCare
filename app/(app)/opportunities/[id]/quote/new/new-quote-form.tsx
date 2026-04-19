"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuote } from "@/lib/quotes/actions";

export function NewQuoteForm({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const defaultValidUntil = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [validUntil, setValidUntil] = React.useState(defaultValidUntil);
  const [notes, setNotes] = React.useState("");
  const [terms, setTerms] = React.useState(
    "Quote valid for 30 days. Deposit may be required at time of acceptance.",
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const id = await createQuote({
        opportunity_id: opportunityId,
        valid_until: validUntil,
        notes: notes || undefined,
        terms: terms || undefined,
      });
      router.push(`/quotes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create quote");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="valid_until">Valid until</Label>
        <Input
          id="valid_until"
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (internal or cover)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms">Terms</Label>
        <textarea
          id="terms"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        />
      </div>
      {error ? <p className="text-xs text-brand-error">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
