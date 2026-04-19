import * as React from "react";
import type { ActivityEntry } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/utils";

interface ActivityTimelineProps {
  events: ActivityEntry[];
  authorNames: Record<string, string>;
}

const ACTION_LABELS: Record<string, string> = {
  "member.created": "Member created",
  "member.updated": "Member updated",
  "member.status_changed": "Status changed",
  "property.created": "Property added",
  "property.updated": "Property updated",
  "territory.created": "Territory created",
  "territory.updated": "Territory updated",
  "territory.zip_codes_changed": "Zip codes changed",
  "lead.created": "Lead created",
  "lead.contacted": "Lead contacted",
  "lead.status_changed": "Lead status changed",
  "lead.converted": "Lead converted",
  "appointment.scheduled": "Appointment scheduled",
  "appointment.rescheduled": "Appointment rescheduled",
  "appointment.completed": "Appointment completed",
  "appointment.cancelled": "Appointment cancelled",
  "appointment.no_show": "Appointment no-show",
};

export function ActivityTimeline({
  events,
  authorNames,
}: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li
          key={e.id}
          className="rounded-md border border-brand-border bg-brand-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-serif text-base text-brand-primary">
                {ACTION_LABELS[e.action] ?? e.action}
              </p>
              <p className="label-mono mt-1">
                {e.user_id ? authorNames[e.user_id] ?? "Unknown" : "System"}
                {" · "}
                <span title={formatDateTime(e.created_at)}>
                  {timeAgo(e.created_at)}
                </span>
              </p>
            </div>
          </div>
          {e.detail && Object.keys(e.detail).length > 0 ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-brand-muted">
              {Object.entries(e.detail).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="label-mono">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-[11px] text-brand-primary">
                    {formatDetailValue(v)}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function formatDetailValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
