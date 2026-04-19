import type { Property } from "@/lib/types";
import { ROOF_MATERIAL_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { PropertyForm } from "./property-form";

export function PropertyList({
  memberId,
  properties,
  canEdit,
}: {
  memberId: string;
  properties: Property[];
  canEdit: boolean;
}) {
  if (properties.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-brand-border p-6 text-center">
        <p className="text-sm text-brand-muted">No properties on file.</p>
        {canEdit ? (
          <div className="mt-4">
            <PropertyForm memberId={memberId} triggerLabel="Add first property" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {properties.map((p) => (
        <li
          key={p.id}
          className="rounded-md border border-brand-border bg-brand-card p-4"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-serif text-base text-brand-primary">
                  {p.street}
                </p>
                {p.is_primary ? (
                  <Badge variant="primary">Primary</Badge>
                ) : null}
              </div>
              <p className="label-mono mt-1">
                {[p.city, p.state, p.zip].filter(Boolean).join(", ") || "—"}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-brand-muted md:grid-cols-4">
                <div>
                  <dt className="label-mono">Material</dt>
                  <dd className="text-brand-primary">
                    {p.roof_material
                      ? ROOF_MATERIAL_LABELS[p.roof_material]
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="label-mono">Age</dt>
                  <dd className="text-brand-primary">
                    {p.roof_age_years != null ? `${p.roof_age_years} yrs` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="label-mono">Sq ft</dt>
                  <dd className="text-brand-primary">
                    {p.square_footage ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="label-mono">Stories</dt>
                  <dd className="text-brand-primary">{p.stories ?? "—"}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.has_solar ? <Badge variant="accent">Solar</Badge> : null}
                {p.has_skylights ? (
                  <Badge variant="default">Skylights</Badge>
                ) : null}
                {p.has_chimney ? (
                  <Badge variant="default">Chimney</Badge>
                ) : null}
              </div>
            </div>
            {canEdit ? (
              <PropertyForm memberId={memberId} existing={p} />
            ) : null}
          </div>
        </li>
      ))}
      {canEdit ? (
        <li>
          <PropertyForm memberId={memberId} />
        </li>
      ) : null}
    </ul>
  );
}
