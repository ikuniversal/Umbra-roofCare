import Link from "next/link";
import type { Inspection, Property } from "@/lib/types";
import {
  ConditionBandBadge,
  InspectionStatusBadge,
} from "@/components/inspections/status-badges";
import { formatDateTime } from "@/lib/utils";

export function InspectionsTable({
  inspections,
  memberMap,
  profileMap,
  propertyMap,
}: {
  inspections: Inspection[];
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
  propertyMap: Record<
    string,
    Pick<Property, "street" | "city" | "state" | "zip">
  >;
}) {
  if (inspections.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-brand-muted">
        No inspections match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-bg/50">
          <tr>
            <th className="label-mono px-4 py-3">Scheduled</th>
            <th className="label-mono px-4 py-3">Member</th>
            <th className="label-mono px-4 py-3">Property</th>
            <th className="label-mono px-4 py-3">Inspector</th>
            <th className="label-mono px-4 py-3">Status</th>
            <th className="label-mono px-4 py-3">Score</th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((i) => {
            const prop = i.property_id ? propertyMap[i.property_id] : null;
            const address = prop
              ? [prop.street, prop.city, prop.state].filter(Boolean).join(", ")
              : "—";
            return (
              <tr
                key={i.id}
                className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
              >
                <td className="px-4 py-3 text-brand-muted">
                  {formatDateTime(i.scheduled_for)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/inspections/${i.id}`}
                    className="font-serif text-base text-brand-primary hover:underline"
                  >
                    {i.member_id
                      ? (memberMap[i.member_id] ?? "Unknown member")
                      : "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-brand-muted">{address}</td>
                <td className="px-4 py-3 text-brand-muted">
                  {i.inspector_id
                    ? (profileMap[i.inspector_id] ?? "Unassigned")
                    : "Unassigned"}
                </td>
                <td className="px-4 py-3">
                  <InspectionStatusBadge status={i.status} />
                </td>
                <td className="px-4 py-3">
                  {i.overall_score !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="metric-figure text-lg text-brand-primary">
                        {i.overall_score}
                      </span>
                      {i.condition_band ? (
                        <ConditionBandBadge band={i.condition_band} />
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-brand-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
