"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { CanvassLead, LeadStatus } from "@/lib/types";
import { LEAD_STATUS_LABELS } from "@/lib/labels";
import { LeadStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { updateLeadStatus } from "./actions";

const QUICK_STATUSES: LeadStatus[] = [
  "knocked_no_answer",
  "conversation",
  "interested",
  "appointment_booked",
  "rejected",
];

export function LeadQuickCard({ lead }: { lead: CanvassLead }) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const applyStatus = (s: LeadStatus) => {
    startTransition(async () => {
      try {
        await updateLeadStatus(lead.id, s, note);
        setNote("");
        setShowNote(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <div className="rounded-lg border border-brand-border bg-brand-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/canvass/leads/${lead.id}`}
            className="font-serif text-base text-brand-primary hover:underline"
          >
            {lead.address}
          </Link>
          <p className="label-mono mt-1">
            Attempt {lead.attempt_count}
            {lead.contacted_at ? ` · ${timeAgo(lead.contacted_at)}` : ""}
          </p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      {lead.last_notes ? (
        <p className="mt-3 rounded-md border border-brand-border bg-brand-bg/60 p-2 text-xs text-brand-muted">
          {lead.last_notes}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {QUICK_STATUSES.filter((s) => s !== lead.status).map((s) => (
          <button
            key={s}
            type="button"
            disabled={isPending}
            onClick={() => applyStatus(s)}
            className="rounded-full border border-brand-border-strong bg-brand-card px-3 py-1 text-xs text-brand-primary transition-colors hover:border-brand-primary disabled:opacity-50"
          >
            {LEAD_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {showNote ? (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quick note (saved with next status update)"
              className="min-h-[60px] w-full rounded-md border border-brand-border-strong bg-brand-card px-2 py-1.5 text-xs text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-xs text-brand-muted hover:text-brand-primary"
          >
            + Add note
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {lead.status === "interested" || lead.status === "appointment_booked" ? (
          <Button asChild size="sm" variant="accent">
            <Link href={`/members/new?from_lead=${lead.id}`}>Convert</Link>
          </Button>
        ) : (
          <span />
        )}
        <Link
          href={`/canvass/leads/${lead.id}`}
          className="text-xs text-brand-muted hover:text-brand-primary"
        >
          Detail →
        </Link>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-brand-error">{error}</p>
      ) : null}
    </div>
  );
}
