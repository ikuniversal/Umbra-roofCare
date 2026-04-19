import { FindingSeverityBadge } from "@/components/inspections/status-badges";
import { FINDING_CATEGORIES } from "@/lib/labels";
import type { InspectionFinding } from "@/lib/types";

const CATEGORY_LABELS = Object.fromEntries(
  FINDING_CATEGORIES.map((c) => [c.value, c.label]),
);

export function FindingsList({
  findings,
  emptyMessage = "No findings recorded.",
}: {
  findings: InspectionFinding[];
  emptyMessage?: string;
}) {
  if (findings.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted">
        {emptyMessage}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {findings.map((f) => (
        <li
          key={f.id}
          className="rounded-md border border-brand-border bg-brand-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FindingSeverityBadge severity={f.severity} />
                <span className="label-mono">
                  {CATEGORY_LABELS[f.category] ?? f.category}
                </span>
              </div>
              <p className="mt-2 font-serif text-base text-brand-primary">
                {f.description}
              </p>
              {f.location ? (
                <p className="mt-1 text-xs text-brand-muted">
                  Location · {f.location}
                </p>
              ) : null}
            </div>
            {f.estimated_repair_cents ? (
              <p className="metric-figure shrink-0 text-lg text-brand-primary">
                ${Math.round(f.estimated_repair_cents / 100).toLocaleString()}
              </p>
            ) : null}
          </div>
          {f.photo_urls && f.photo_urls.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {f.photo_urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block h-16 w-20 overflow-hidden rounded border border-brand-border bg-brand-bg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Finding"
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
