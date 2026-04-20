import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  OPPORTUNITY_PRIORITY_LABELS,
  OPPORTUNITY_PRIORITY_VARIANTS,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_VARIANTS,
  OPPORTUNITY_TYPE_LABELS,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export function OpportunityTable({
  opportunities,
  memberMap,
  profileMap,
}: {
  opportunities: Opportunity[];
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
}) {
  if (opportunities.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-brand-border px-4 py-10 text-center text-sm text-brand-muted">
        No opportunities yet. Completed inspections feed the pipeline.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-brand-border bg-brand-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-bg/50">
          <tr>
            <th className="label-mono px-4 py-3">Member</th>
            <th className="label-mono px-4 py-3">Type</th>
            <th className="label-mono px-4 py-3">Stage</th>
            <th className="label-mono px-4 py-3">Priority</th>
            <th className="label-mono px-4 py-3">Estimate</th>
            <th className="label-mono px-4 py-3">Assigned</th>
            <th className="label-mono px-4 py-3">Close</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr
              key={o.id}
              className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/opportunities/${o.id}`}
                  className="font-serif text-base text-brand-primary hover:underline"
                >
                  {o.member_id ? (memberMap[o.member_id] ?? "Unknown") : "—"}
                </Link>
              </td>
              <td className="px-4 py-3 text-brand-muted">
                {o.type ? OPPORTUNITY_TYPE_LABELS[o.type] : "—"}
              </td>
              <td className="px-4 py-3">
                <Badge variant={OPPORTUNITY_STAGE_VARIANTS[o.stage]}>
                  {OPPORTUNITY_STAGE_LABELS[o.stage]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={OPPORTUNITY_PRIORITY_VARIANTS[o.priority]}>
                  {OPPORTUNITY_PRIORITY_LABELS[o.priority]}
                </Badge>
              </td>
              <td className="px-4 py-3 metric-figure text-brand-primary">
                {o.value_estimate
                  ? `$${Math.round(o.value_estimate).toLocaleString()}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-brand-muted">
                {o.assigned_to
                  ? (profileMap[o.assigned_to] ?? "—")
                  : "—"}
              </td>
              <td className="px-4 py-3 text-brand-muted">
                {formatDate(o.expected_close_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
