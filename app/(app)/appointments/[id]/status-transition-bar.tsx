"use client";

import { useState, useTransition } from "react";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/labels";
import type { AppointmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setAppointmentStatus } from "../actions";

const OPTIONS: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "completed",
  "rescheduled",
  "cancelled",
  "no_show",
];

export function StatusTransitionBar({
  appointmentId,
  current,
}: {
  appointmentId: string;
  current: AppointmentStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (s: AppointmentStatus) => {
    if (s === current) return;
    startTransition(async () => {
      try {
        await setAppointmentStatus(appointmentId, s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((s) => {
          const active = s === current;
          return (
            <button
              key={s}
              type="button"
              onClick={() => apply(s)}
              disabled={isPending || active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-brand-primary bg-brand-primary text-brand-bg"
                  : "border-brand-border-strong bg-brand-card text-brand-primary hover:border-brand-primary",
                isPending ? "opacity-50" : "",
              )}
            >
              {APPOINTMENT_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-brand-error">{error}</p> : null}
    </div>
  );
}
