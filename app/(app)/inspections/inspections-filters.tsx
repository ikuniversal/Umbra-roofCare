"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { INSPECTION_STATUS_LABELS } from "@/lib/labels";
import type { InspectionStatus } from "@/lib/types";

const STATUS_OPTIONS: (InspectionStatus | "all")[] = [
  "all",
  "scheduled",
  "in_progress",
  "completed",
  "needs_review",
  "cancelled",
];
const RANGE_OPTIONS: { value: "today" | "week" | "month" | "all"; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "Last 30d" },
  { value: "all", label: "All time" },
];

export function InspectionsFilters({
  status,
  range,
  mine,
}: {
  status: InspectionStatus | "all";
  range: "today" | "week" | "month" | "all";
  mine: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const apply = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v === null || v === "") sp.delete(k);
    else sp.set(k, v);
    router.push(`/inspections?${sp.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-brand-border bg-brand-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono">Range</span>
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => apply("range", r.value)}
          >
            <Badge variant={range === r.value ? "primary" : "outline"}>
              {r.label}
            </Badge>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono">Status</span>
        {STATUS_OPTIONS.map((s) => (
          <button key={s} type="button" onClick={() => apply("status", s === "all" ? null : s)}>
            <Badge variant={status === s ? "primary" : "outline"}>
              {s === "all" ? "All" : INSPECTION_STATUS_LABELS[s as InspectionStatus]}
            </Badge>
          </button>
        ))}
      </div>
      <div className="ml-auto">
        <Checkbox
          id="mine"
          label={<span className="text-sm">Only mine</span>}
          checked={mine}
          onChange={(e) =>
            apply("mine", (e.target as HTMLInputElement).checked ? "1" : null)
          }
        />
      </div>
    </div>
  );
}
