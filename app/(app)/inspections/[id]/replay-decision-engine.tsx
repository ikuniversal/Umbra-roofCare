"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { replayDecisionEngine } from "@/lib/inspections/actions";

export function ReplayDecisionEngine({
  inspectionId,
}: {
  inspectionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const run = () => {
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await replayDecisionEngine(inspectionId);
        setStatus(
          res.matchedRuleName
            ? `Matched: ${res.matchedRuleName} · +${res.opportunities.length} opp${res.opportunities.length === 1 ? "" : "s"}`
            : "No rule matched.",
        );
        router.refresh();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Replay failed");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" onClick={run} disabled={pending}>
        {pending ? "Replaying…" : "Replay engine"}
      </Button>
      {status ? <span className="text-xs text-brand-muted">{status}</span> : null}
    </div>
  );
}
