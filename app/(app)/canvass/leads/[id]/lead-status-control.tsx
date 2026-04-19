"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "@/lib/labels";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateLeadStatus } from "../../actions";

export function LeadStatusControl({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: LeadStatus;
}) {
  const [status, setStatus] = useState<LeadStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      try {
        await updateLeadStatus(leadId, status, note);
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LEAD_STATUS_ORDER.map((s) => {
          const active = s === status;
          return (
            <button
              type="button"
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-brand-primary bg-brand-primary text-brand-bg"
                  : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary",
              )}
            >
              {LEAD_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-note">Note (optional)</Label>
        <textarea
          id="lead-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened on this door?"
          className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        />
      </div>

      {error ? <p className="text-sm text-brand-error">{error}</p> : null}

      <div className="flex justify-end">
        <Button onClick={save} disabled={isPending || status === currentStatus && !note.trim()}>
          {isPending ? "Saving…" : "Save touch"}
        </Button>
      </div>
    </div>
  );
}
