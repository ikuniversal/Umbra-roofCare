import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  canCreateQuote,
  canEditOpportunity,
  canViewOpportunities,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  Member,
  Opportunity,
  Profile,
  Quote,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  OPPORTUNITY_PRIORITY_LABELS,
  OPPORTUNITY_PRIORITY_VARIANTS,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_VARIANTS,
  OPPORTUNITY_TYPE_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANTS,
} from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { OpportunityEditForm } from "./edit-form";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canViewOpportunities(session.roles)) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle<Opportunity>();
  if (!opp) notFound();

  const [memberRes, inspectionRes, quotesRes, activityRes, profilesRes] =
    await Promise.all([
      opp.member_id
        ? supabase
            .from("members")
            .select("*")
            .eq("id", opp.member_id)
            .maybeSingle<Member>()
        : Promise.resolve({ data: null }),
      opp.inspection_id
        ? supabase
            .from("inspections")
            .select("id, overall_score, condition_band, completed_at, report_pdf_url")
            .eq("id", opp.inspection_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("quotes")
        .select("*")
        .eq("opportunity_id", opp.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", "opportunity")
        .eq("entity_id", opp.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const member = (memberRes.data ?? null) as Member | null;
  const inspection = inspectionRes.data as {
    id: string;
    overall_score: number | null;
    condition_band: string | null;
    completed_at: string | null;
    report_pdf_url: string | null;
  } | null;
  const quotes = (quotesRes.data ?? []) as Quote[];
  const activity = (activityRes.data ?? []) as ActivityEntry[];
  const profiles = (profilesRes.data ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email"
  >[];
  const profileMap = Object.fromEntries(
    profiles.map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]),
  );

  const canEdit = canEditOpportunity(
    session.roles,
    {
      assigned_specialist_id: opp.assigned_specialist_id,
      assigned_to: opp.assigned_to,
    },
    session.userId,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title={
          member ? `${member.first_name} ${member.last_name}` : "Opportunity"
        }
        description={
          opp.type
            ? `${OPPORTUNITY_TYPE_LABELS[opp.type]} · Opened ${formatDate(
                opp.opened_at,
              )}`
            : "Opportunity"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateQuote(session.roles) ? (
              <Button asChild variant="accent">
                <Link href={`/opportunities/${opp.id}/quote/new`}>
                  New quote
                </Link>
              </Button>
            ) : null}
            {member ? (
              <Button asChild variant="outline">
                <Link href={`/members/${member.id}`}>Member profile</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <SummaryTile label="Stage">
          <Badge variant={OPPORTUNITY_STAGE_VARIANTS[opp.stage]}>
            {OPPORTUNITY_STAGE_LABELS[opp.stage]}
          </Badge>
        </SummaryTile>
        <SummaryTile label="Priority">
          <Badge variant={OPPORTUNITY_PRIORITY_VARIANTS[opp.priority]}>
            {OPPORTUNITY_PRIORITY_LABELS[opp.priority]}
          </Badge>
        </SummaryTile>
        <SummaryTile label="Estimate">
          <span className="metric-figure text-lg text-brand-primary">
            {opp.value_estimate
              ? `$${Math.round(opp.value_estimate).toLocaleString()}`
              : "—"}
          </span>
        </SummaryTile>
        <SummaryTile label="Assigned">
          <span className="text-sm text-brand-primary">
            {opp.assigned_to
              ? (profileMap[opp.assigned_to] ?? "—")
              : "Unassigned"}
          </span>
        </SummaryTile>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="future">Future</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="label-mono">Details</p>
                <CardTitle>Pipeline info</CardTitle>
              </CardHeader>
              <CardContent>
                <OpportunityEditForm
                  opportunity={opp}
                  profiles={profiles}
                  canEdit={canEdit}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <p className="label-mono">Source</p>
                <CardTitle>Inspection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {inspection ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-brand-muted">Score</p>
                      <span className="metric-figure text-xl text-brand-primary">
                        {inspection.overall_score ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-brand-muted">Condition</p>
                      <p className="text-brand-primary">
                        {inspection.condition_band ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-brand-muted">Completed</p>
                      <p className="text-brand-primary">
                        {formatDate(inspection.completed_at)}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        href={`/inspections/${inspection.id}`}
                        className="text-sm text-brand-accent hover:underline"
                      >
                        View inspection →
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-brand-muted">
                    This opportunity wasn&apos;t linked to an inspection.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Quotes</CardTitle>
              {canCreateQuote(session.roles) ? (
                <Button asChild size="sm" variant="accent">
                  <Link href={`/opportunities/${opp.id}/quote/new`}>
                    New quote
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="rounded-md border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
                  No quotes yet. Create the first one.
                </p>
              ) : (
                <ul className="divide-y divide-brand-border">
                  {quotes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-serif text-base text-brand-primary hover:underline"
                        >
                          {q.quote_number}
                        </Link>
                        <p className="mt-1 text-xs text-brand-muted">
                          Created {formatDateTime(q.created_at)}
                          {q.valid_until
                            ? ` · Valid until ${formatDate(q.valid_until)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="metric-figure text-lg text-brand-primary">
                          ${Math.round(q.total).toLocaleString()}
                        </span>
                        <Badge variant={QUOTE_STATUS_VARIANTS[q.status]}>
                          {QUOTE_STATUS_LABELS[q.status]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTimeline events={activity} authorNames={profileMap} />
        </TabsContent>

        <TabsContent value="future">
          <Card>
            <CardContent className="py-8 text-center text-sm text-brand-muted">
              Subscriptions + Commissions land in Phase 5.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-brand-border bg-brand-card p-3">
      <p className="label-mono">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
