"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/labels";
import type { AppointmentStatus, AppointmentType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: (AppointmentType | "all")[] = [
  "all",
  "enrollment",
  "inspection",
  "consultation",
  "service_quote",
  "follow_up",
];

const STATUSES: (AppointmentStatus | "all")[] = [
  "all",
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

export function AppointmentsFilters({
  mode,
  type,
  status,
}: {
  mode: "calendar" | "list";
  type: AppointmentType | "all";
  status: AppointmentStatus | "all";
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const apply = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    });
    router.push(`/appointments?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => apply({ mode: "list" })}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs transition-colors",
            mode === "list"
              ? "border-brand-primary bg-brand-primary text-brand-bg"
              : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary",
          )}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => apply({ mode: "calendar" })}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs transition-colors",
            mode === "calendar"
              ? "border-brand-primary bg-brand-primary text-brand-bg"
              : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary",
          )}
        >
          Week
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => apply({ type: t })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                active
                  ? "border-brand-primary bg-brand-primary text-brand-bg"
                  : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary",
              )}
            >
              {t === "all" ? "All types" : APPOINTMENT_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => apply({ status: s })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                active
                  ? "border-brand-primary bg-brand-primary text-brand-bg"
                  : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary",
              )}
            >
              {s === "all" ? "All statuses" : APPOINTMENT_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
