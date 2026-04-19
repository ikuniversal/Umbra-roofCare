import Link from "next/link";
import type { Appointment } from "@/lib/types";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/labels";
import { AppointmentStatusBadge } from "@/components/status-badges";
import {
  addDays,
  formatDate,
  formatDateTime,
  formatTime,
  startOfWeek,
} from "@/lib/utils";

interface Props {
  appointments: Appointment[];
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
  mode: "calendar" | "list";
}

export function AppointmentsView({
  appointments,
  memberMap,
  profileMap,
  mode,
}: Props) {
  if (appointments.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-brand-muted">
        No appointments match the current filters.
      </p>
    );
  }

  if (mode === "calendar") {
    return (
      <WeekView
        appointments={appointments}
        memberMap={memberMap}
      />
    );
  }

  return (
    <div className="divide-y divide-brand-border">
      {appointments.map((a) => (
        <Link
          href={`/appointments/${a.id}`}
          key={a.id}
          className="flex flex-col gap-1 p-4 transition-colors hover:bg-brand-bg/40 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="font-serif text-base text-brand-primary">
              {APPOINTMENT_TYPE_LABELS[a.type]}
              {a.member_id && memberMap[a.member_id]
                ? ` · ${memberMap[a.member_id]}`
                : ""}
            </p>
            <p className="label-mono mt-0.5">
              {formatDateTime(a.scheduled_for)}
              {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
              {a.assigned_to && profileMap[a.assigned_to]
                ? ` · ${profileMap[a.assigned_to]}`
                : ""}
            </p>
          </div>
          <AppointmentStatusBadge status={a.status} />
        </Link>
      ))}
    </div>
  );
}

function WeekView({
  appointments,
  memberMap,
}: {
  appointments: Appointment[];
  memberMap: Record<string, string>;
}) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const grouped = new Map<string, Appointment[]>();
  days.forEach((d) => grouped.set(isoDay(d), []));
  appointments.forEach((a) => {
    const d = isoDay(new Date(a.scheduled_for));
    if (grouped.has(d)) grouped.get(d)!.push(a);
  });

  return (
    <div className="grid grid-cols-1 divide-y divide-brand-border md:grid-cols-7 md:divide-x md:divide-y-0">
      {days.map((d) => {
        const dayAppts = grouped.get(isoDay(d)) ?? [];
        const isToday = isoDay(d) === isoDay(now);
        return (
          <div
            key={isoDay(d)}
            className="flex min-h-[160px] flex-col p-3"
          >
            <p
              className={
                "label-mono " +
                (isToday ? "!text-brand-accent" : "!text-brand-muted")
              }
            >
              {d.toLocaleDateString("en-US", { weekday: "short" })}{" "}
              {d.getDate()}
            </p>
            <div className="mt-2 space-y-2">
              {dayAppts.length === 0 ? (
                <p className="text-[11px] text-brand-faint">—</p>
              ) : (
                dayAppts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/appointments/${a.id}`}
                    className="block rounded-md border border-brand-border bg-brand-card p-2 text-xs hover:border-brand-primary"
                  >
                    <p className="font-mono text-[10px] text-brand-muted">
                      {formatTime(a.scheduled_for)}
                    </p>
                    <p className="mt-0.5 text-brand-primary">
                      {APPOINTMENT_TYPE_LABELS[a.type]}
                    </p>
                    {a.member_id && memberMap[a.member_id] ? (
                      <p className="text-[11px] text-brand-muted">
                        {memberMap[a.member_id]}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-brand-faint">
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
      <div className="p-3 md:col-span-7">
        <p className="label-mono">
          Week of {formatDate(weekStart)} — {formatDate(days[6])}
        </p>
      </div>
    </div>
  );
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
