import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageTerritories } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Territory } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TerritoryFormDialog } from "./territory-form-dialog";

export default async function TerritoriesPage() {
  const session = await requireSession();
  if (!canManageTerritories(session.roles)) redirect("/canvass");

  const supabase = await createClient();
  const { data } = await supabase
    .from("territories")
    .select("*")
    .order("name", { ascending: true });
  const territories = (data ?? []) as Territory[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Canvass"
        title="Territories"
        description="Group leads by zip-code footprints. GIS polygons land in Phase 8."
        actions={<TerritoryFormDialog />}
      />

      <div className="mt-8 space-y-3">
        {territories.length === 0 ? (
          <p className="rounded-md border border-dashed border-brand-border px-4 py-10 text-center text-sm text-brand-muted">
            No territories yet — create the first one.
          </p>
        ) : (
          territories.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/canvass/territories/${t.id}`}
                      className="font-serif text-lg text-brand-primary hover:underline"
                    >
                      {t.name}
                    </Link>
                    {!t.active ? (
                      <Badge variant="outline">Inactive</Badge>
                    ) : null}
                  </div>
                  <p className="label-mono mt-1">
                    {t.total_doors ? `${t.total_doors} doors · ` : ""}
                    {(t.zip_codes ?? []).length} zip codes
                  </p>
                  {t.zip_codes && t.zip_codes.length > 0 ? (
                    <p className="mt-1 font-mono text-xs text-brand-muted">
                      {t.zip_codes.join(", ")}
                    </p>
                  ) : null}
                </div>
                <TerritoryFormDialog existing={t} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
