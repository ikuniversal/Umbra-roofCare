import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  canCaptureInspection,
  canViewInspectionReport,
  isPlatformAdmin,
  hasRole,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  Inspection,
  InspectionFinding,
  InspectionTemplate,
  Member,
  Opportunity,
  Profile,
  Property,
  TemplateCheckpoint,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  InspectionStatusBadge,
  OpportunityPriorityBadge,
  OpportunityStatusBadge,
  OpportunityTypeBadge,
} from "@/components/inspections/status-badges";
import { ScoreDisplay } from "@/components/inspections/score-display";
import { FindingsList } from "@/components/inspections/findings-list";
import { PhotoGrid } from "@/components/inspections/photo-grid";
import {
  DEFAULT_CHECKPOINTS,
  groupCheckpointsByCategory,
  sortCheckpoints,
} from "@/lib/inspections/template";
import { mergeResults, scoreInspection } from "@/lib/inspections/scoring";
import { CHECKPOINT_RATING_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { ReplayDecisionEngine } from "./replay-decision-engine";
import { GenerateReportButton } from "./generate-report-button";
import { AddFindingButton } from "./add-finding-button";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: insp } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle<Inspection>();
  if (!insp) notFound();

  const [
    memberRes,
    propertyRes,
    inspectorRes,
    templateRes,
    findingsRes,
    opportunitiesRes,
    activityRes,
  ] = await Promise.all([
    insp.member_id
      ? supabase
          .from("members")
          .select("*")
          .eq("id", insp.member_id)
          .maybeSingle<Member>()
      : Promise.resolve({ data: null }),
    insp.property_id
      ? supabase
          .from("properties")
          .select("*")
          .eq("id", insp.property_id)
          .maybeSingle<Property>()
      : Promise.resolve({ data: null }),
    insp.inspector_id
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", insp.inspector_id)
          .maybeSingle<Pick<Profile, "id" | "full_name" | "email">>()
      : Promise.resolve({ data: null }),
    insp.template_id
      ? supabase
          .from("inspection_templates")
          .select("*")
          .eq("id", insp.template_id)
          .maybeSingle<InspectionTemplate>()
      : Promise.resolve({ data: null }),
    supabase
      .from("inspection_findings")
      .select("*")
      .eq("inspection_id", insp.id)
      .order("severity", { ascending: false }),
    supabase
      .from("opportunities")
      .select("*")
      .eq("inspection_id", insp.id),
    supabase
      .from("activity_log")
      .select("*")
      .eq("entity_type", "inspection")
      .eq("entity_id", insp.id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const member = (memberRes.data ?? null) as Member | null;
  const property = (propertyRes.data ?? null) as Property | null;
  const inspector = (inspectorRes.data ?? null) as
    | Pick<Profile, "id" | "full_name" | "email">
    | null;
  const template = (templateRes.data ?? null) as InspectionTemplate | null;
  const findings = (findingsRes.data ?? []) as InspectionFinding[];
  const opportunities = (opportunitiesRes.data ?? []) as Opportunity[];
  const activity = (activityRes.data ?? []) as ActivityEntry[];

  const checkpoints: TemplateCheckpoint[] = template?.checkpoints
    ? (template.checkpoints as TemplateCheckpoint[])
    : DEFAULT_CHECKPOINTS;
  const sortedCheckpoints = sortCheckpoints(checkpoints);
  const results = mergeResults(sortedCheckpoints, insp.checkpoint_results);
  const liveBreakdown = scoreInspection(sortedCheckpoints, results);
  const grouped = groupCheckpointsByCategory(sortedCheckpoints);

  const checkpointPhotos = results.flatMap((r) =>
    (r.photo_urls ?? []).map((url) => ({ url, source: r.checkpoint_id })),
  );
  const findingPhotos = findings.flatMap((f) =>
    (f.photo_urls ?? []).map((url) => ({ url, source: `finding-${f.id}` })),
  );
  const heroPhotos = (
    (insp.photos_manifest as { hero_photo_urls?: string[] } | null)
      ?.hero_photo_urls ?? []
  ).filter(Boolean);
  const allPhotoUrls = Array.from(
    new Set([
      ...heroPhotos,
      ...findingPhotos.map((p) => p.url),
      ...checkpointPhotos.map((p) => p.url),
    ]),
  );

  const address = property
    ? [property.street, property.city, property.state, property.zip]
        .filter(Boolean)
        .join(", ")
    : "—";

  const canCapture = canCaptureInspection(
    session.roles,
    { inspector_id: insp.inspector_id, status: insp.status },
    session.userId,
  );
  const canReplay =
    isPlatformAdmin(session.roles) ||
    hasRole(session.roles, [
      "opco_gm",
      "sales_manager",
      "area_manager",
      "team_lead",
    ]);

  const authorNames: Record<string, string> = {};
  if (inspector?.id) {
    authorNames[inspector.id] =
      inspector.full_name ?? inspector.email ?? "Inspector";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow={`Delivery · Phase 3 · ${insp.status === "completed" ? "Report" : "In progress"}`}
        title={member ? `${member.first_name} ${member.last_name}` : "Inspection"}
        description={address}
        actions={
          <div className="flex flex-wrap gap-2">
            {canCapture ? (
              <Button asChild variant="accent">
                <Link href={`/inspections/${insp.id}/capture`}>
                  {insp.status === "scheduled" ? "Start capture" : "Continue"}
                </Link>
              </Button>
            ) : null}
            {insp.status === "completed" && canViewInspectionReport(session.roles) ? (
              <GenerateReportButton
                inspectionId={insp.id}
                currentUrl={insp.report_pdf_url}
              />
            ) : null}
            {canReplay && insp.status === "completed" ? (
              <ReplayDecisionEngine inspectionId={insp.id} />
            ) : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto]">
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div>
              <p className="label-mono">Status</p>
              <div className="mt-2">
                <InspectionStatusBadge status={insp.status} />
              </div>
            </div>
            <div>
              <p className="label-mono">Scheduled</p>
              <p className="mt-2 text-sm text-brand-primary">
                {formatDateTime(insp.scheduled_for)}
              </p>
            </div>
            <div>
              <p className="label-mono">Inspector</p>
              <p className="mt-2 text-sm text-brand-primary">
                {inspector?.full_name ?? inspector?.email ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="label-mono">Completed</p>
              <p className="mt-2 text-sm text-brand-primary">
                {insp.completed_at
                  ? formatDateTime(insp.completed_at)
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full items-center justify-center p-6">
            <ScoreDisplay
              score={insp.overall_score ?? liveBreakdown.score}
              band={insp.condition_band ?? liveBreakdown.band}
              action={insp.recommended_action ?? liveBreakdown.action}
              size="lg"
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
          <TabsTrigger value="findings">
            Findings ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="photos">
            Photos ({allPhotoUrls.length})
          </TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="label-mono">Member</p>
                <CardTitle>
                  {member ? `${member.first_name} ${member.last_name}` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-brand-muted">
                  {member?.email ?? "No email"}
                </p>
                <p className="text-brand-muted">
                  {member?.phone ?? "No phone"}
                </p>
                {member ? (
                  <Link
                    href={`/members/${member.id}`}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Open member profile →
                  </Link>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <p className="label-mono">Property</p>
                <CardTitle>{address}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-brand-muted">
                {property?.roof_material ? (
                  <p>Material: {property.roof_material.replace(/_/g, " ")}</p>
                ) : null}
                {property?.roof_age_years ? (
                  <p>Roof age: {property.roof_age_years}y</p>
                ) : null}
                {property?.square_footage ? (
                  <p>Square footage: {property.square_footage}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <OpportunityPanel opportunities={opportunities} />
        </TabsContent>

        <TabsContent value="checkpoints">
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, cps]) => (
              <div key={category}>
                <p className="label-mono mb-2">{category}</p>
                <ul className="overflow-hidden rounded-md border border-brand-border">
                  {cps.map((cp) => {
                    const r = results.find(
                      (x) => x.checkpoint_id === cp.id,
                    );
                    return (
                      <li
                        key={cp.id}
                        className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-border bg-brand-card px-4 py-3 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-base text-brand-primary">
                            {cp.label}
                          </p>
                          {r?.notes ? (
                            <p className="mt-1 text-xs text-brand-muted">
                              {r.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-brand-muted">
                          <span className="label-mono">wt {cp.weight}</span>
                          {r?.rating ? (
                            <span
                              className={
                                r.rating === "pass"
                                  ? "rounded-full border border-brand-success/40 bg-brand-success/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-success"
                                  : r.rating === "warn"
                                    ? "rounded-full border border-brand-warn/40 bg-brand-warn/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-warn"
                                    : "rounded-full border border-brand-error/40 bg-brand-error/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-error"
                              }
                            >
                              {CHECKPOINT_RATING_LABELS[r.rating]}
                            </span>
                          ) : (
                            <span className="text-xs text-brand-faint">
                              Not rated
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="label-mono">
                {findings.length} finding{findings.length === 1 ? "" : "s"}
              </p>
              {canCapture ? (
                <AddFindingButton inspectionId={insp.id} />
              ) : null}
            </div>
            <FindingsList findings={findings} />
          </div>
        </TabsContent>

        <TabsContent value="photos">
          <PhotoGrid
            urls={allPhotoUrls}
            emptyMessage="No photos uploaded yet."
          />
        </TabsContent>

        <TabsContent value="score">
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            <Card>
              <CardContent className="flex items-center justify-center p-6">
                <ScoreDisplay
                  score={insp.overall_score}
                  band={insp.condition_band}
                  action={insp.recommended_action}
                  size="lg"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <p className="label-mono">By category</p>
                <CardTitle>Score breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-brand-muted">
                      <th className="label-mono pb-2">Category</th>
                      <th className="label-mono pb-2 text-right">Weight</th>
                      <th className="label-mono pb-2 text-right">Earned</th>
                      <th className="label-mono pb-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(liveBreakdown.byCategory).map(
                      ([cat, v]) => {
                        const pct = v.weight
                          ? Math.round((v.score / v.weight) * 100)
                          : 0;
                        return (
                          <tr
                            key={cat}
                            className="border-t border-brand-border"
                          >
                            <td className="py-2 text-brand-primary">{cat}</td>
                            <td className="py-2 text-right text-brand-muted">
                              {v.weight}
                            </td>
                            <td className="py-2 text-right text-brand-muted">
                              {Math.round(v.score)}
                            </td>
                            <td className="py-2 text-right text-brand-primary">
                              {pct}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <p className="label-mono">PDF report</p>
              <CardTitle>
                {insp.report_pdf_url ? "Available" : "Not generated"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-brand-muted">
              {insp.report_pdf_url ? (
                <>
                  <p>
                    The latest report PDF was rendered by the
                    <code className="mx-1 rounded bg-brand-bg px-1 py-0.5 font-mono text-[11px]">
                      generate-inspection-report
                    </code>
                    edge function.
                  </p>
                  <Button asChild>
                    <a
                      href={insp.report_pdf_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download PDF
                    </a>
                  </Button>
                </>
              ) : (
                <p>
                  Complete the inspection and press <em>Generate report</em>{" "}
                  to render a PDF.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTimeline events={activity} authorNames={authorNames} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OpportunityPanel({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  if (opportunities.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <p className="label-mono">Decision Engine</p>
          <CardTitle>No opportunities created</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-brand-muted">
          Either the engine hasn&apos;t been run, or the winning rule was a
          log-only (healthy roof) outcome.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="mt-6">
      <CardHeader>
        <p className="label-mono">Decision Engine · Opportunities</p>
        <CardTitle>{opportunities.length} created</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {opportunities.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-border bg-brand-bg/50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                {o.type ? <OpportunityTypeBadge type={o.type} /> : null}
                <OpportunityPriorityBadge priority={o.priority} />
                <OpportunityStatusBadge status={o.status} />
              </div>
              {o.notes ? (
                <p className="min-w-0 flex-1 text-xs text-brand-muted">
                  {o.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
