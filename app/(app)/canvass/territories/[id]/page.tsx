import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageTerritories } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { CanvassLead, Territory } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/status-badges";
import { TerritoryFormDialog } from "../territory-form-dialog";
import { AddLeadForm } from "./add-lead-form";

export default async function TerritoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: territoryData } = await supabase
    .from("territories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const territory = territoryData as Territory | null;
  if (!territory) notFound();

  const { data: leadsData } = await supabase
    .from("canvass_leads")
    .select("*")
    .eq("territory_id", id)
    .order("updated_at", { ascending: false });
  const leads = (leadsData ?? []) as CanvassLead[];

  const canManage = canManageTerritories(session.roles);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Territory"
        title={territory.name}
        description={
          territory.zip_codes?.length
            ? `ZIPs: ${territory.zip_codes.join(", ")}`
            : "No zip codes set."
        }
        actions={canManage ? <TerritoryFormDialog existing={territory} /> : null}
      />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="label-mono">Leads</p>
            <CardTitle>{leads.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="label-mono">Est. doors</p>
            <CardTitle>{territory.total_doors ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="label-mono">Status</p>
            <CardTitle>{territory.active ? "Active" : "Inactive"}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="mt-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-light text-brand-primary">
            Leads in this territory
          </h2>
          <AddLeadForm territoryId={territory.id} />
        </div>

        {leads.length === 0 ? (
          <p className="rounded-md border border-dashed border-brand-border px-4 py-10 text-center text-sm text-brand-muted">
            No leads under this territory yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-md border border-brand-border bg-brand-card p-3"
              >
                <Link
                  href={`/canvass/leads/${l.id}`}
                  className="font-serif text-brand-primary hover:underline"
                >
                  {l.address}
                </Link>
                <div className="flex items-center gap-3">
                  <p className="label-mono hidden md:block">
                    attempts {l.attempt_count}
                  </p>
                  <LeadStatusBadge status={l.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
