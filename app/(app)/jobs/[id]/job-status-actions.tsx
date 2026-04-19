"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelJob, startJob } from "@/lib/jobs/actions";
import type { Job } from "@/lib/types";

export function JobStatusActions({
  job,
  canSchedule,
}: {
  job: Job;
  canSchedule: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const start = async () => {
    setPending("start");
    setError(null);
    try {
      await startJob(job.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setPending(null);
    }
  };

  const cancel = async () => {
    const reason = prompt("Reason for cancellation?");
    if (reason === null) return;
    setPending("cancel");
    setError(null);
    try {
      await cancelJob(job.id, reason);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {job.status === "scheduled" && canSchedule ? (
        <Button size="sm" variant="accent" onClick={start} disabled={pending === "start"}>
          {pending === "start" ? "Starting…" : "Start job"}
        </Button>
      ) : null}
      {job.status === "in_progress" ? (
        <Button asChild size="sm" variant="accent">
          <Link href={`/jobs/${job.id}/complete`}>Complete</Link>
        </Button>
      ) : null}
      {canSchedule &&
      job.status !== "completed" &&
      job.status !== "cancelled" ? (
        <Button size="sm" variant="ghost" onClick={cancel} disabled={pending === "cancel"}>
          {pending === "cancel" ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
      {error ? <span className="text-xs text-brand-error">{error}</span> : null}
    </div>
  );
}
