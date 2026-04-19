import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canManageTerritories } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { CanvassLead, Territory } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/status-badges";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { LeadQuickCard } from "./lead-quick-card";

export default async function CanvassDashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [leadsRes, territoriesRes] = await Promise.all([
    supabase
      .from("canvass_leads")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("territories")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  const leads = (leadsRes.data ?? []) as CanvassLead[];
  const territories = (territoriesRes.data ?? []) as Territory[];

  const myLeads = leads.filter((l) => l.contacted_by === session.userId);
  const unassigned = leads.filter((l) => !l.contacted_by);

  const statusCounts = LEAD_STATUS_ORDER.map((s) => ({
    status: s,
    count: leads.filter((l) => l.status === s).length,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Growth · Phase 2"
        title="Canvass"
        description="Today's doors, the queues under each territory, and every lead's last touch."
        actions={
          canManageTerritories(session.roles) ? (
            <Button asChild variant="outline">
              <Link href="/canvass/territories">Territories</Link>
            </Button>
          ) : null
        }
      />

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        {statusCounts.map((s) => (
          <Card key={s.status}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="label-mono">
                  {LEAD_STATUS_LABELS[s.status]}
                </p>
                <p className="mt-1 font-serif text-2xl text-brand-primary">
                  {s.count}
                </p>
              </div>
              <LeadStatusBadge status={s.status} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono">Your queue</p>
            <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
              My leads
            </h2>
          </div>
          <p className="text-sm text-brand-muted">{myLeads.length} total</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {myLeads.length === 0 ? (
            <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted md:col-span-2">
              No leads assigned to you yet. Start a door on the unassigned list
              below.
            </p>
          ) : (
            myLeads.map((lead) => (
              <LeadQuickCard key={lead.id} lead={lead} />
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono">Up for grabs</p>
            <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
              Unassigned leads
            </h2>
          </div>
          <p className="text-sm text-brand-muted">{unassigned.length} total</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {unassigned.slice(0, 20).map((lead) => (
            <LeadQuickCard key={lead.id} lead={lead} />
          ))}
          {unassigned.length === 0 ? (
            <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted md:col-span-2">
              No unassigned leads right now.
            </p>
          ) : null}
        </div>
      </section>

      {territories.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-mono">Territory overview</p>
              <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
                Coverage
              </h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {territories.map((t) => {
              const count = leads.filter((l) => l.territory_id === t.id).length;
              return (
                <Card key={t.id}>
                  <CardHeader>
                    <p className="label-mono">Territory</p>
                    <CardTitle>
                      <Link
                        href={`/canvass/territories/${t.id}`}
                        className="hover:underline"
                      >
                        {t.name}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <p className="label-mono">Zip codes</p>
                      <p className="mt-1 font-mono text-xs text-brand-primary">
                        {t.zip_codes?.join(", ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="label-mono">Leads</p>
                      <p className="text-brand-primary">{count}</p>
                    </div>
                    <p className="text-[11px] text-brand-faint">
                      Created {formatDate(t.created_at)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
