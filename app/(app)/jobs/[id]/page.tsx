import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canScheduleJob, canViewJobs } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  Crew,
  Job,
  Member,
  Profile,
  Property,
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
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_VARIANTS,
  JOB_STATUS_LABELS,
  JOB_STATUS_VARIANTS,
  JOB_TYPE_LABELS,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { PhotoGrid } from "@/components/inspections/photo-grid";
import { JobScheduleCard } from "./job-schedule-card";
import { JobStatusActions } from "./job-status-actions";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canViewJobs(session.roles)) redirect("/dashboard");
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle<Job>();
  if (!job) notFound();

  const [
    memberRes,
    propertyRes,
    quoteRes,
    crewRes,
    allCrewsRes,
    activityRes,
    profilesRes,
  ] = await Promise.all([
    job.member_id
      ? supabase
          .from("members")
          .select("*")
          .eq("id", job.member_id)
          .maybeSingle<Member>()
      : Promise.resolve({ data: null }),
    job.property_id
      ? supabase
          .from("properties")
          .select("*")
          .eq("id", job.property_id)
          .maybeSingle<Property>()
      : Promise.resolve({ data: null }),
    job.quote_id
      ? supabase
          .from("quotes")
          .select("id, quote_number, total, status")
          .eq("id", job.quote_id)
          .maybeSingle<Pick<Quote, "id" | "quote_number" | "total" | "status">>()
      : Promise.resolve({ data: null }),
    job.crew_id
      ? supabase
          .from("crews")
          .select("*")
          .eq("id", job.crew_id)
          .maybeSingle<Crew>()
      : Promise.resolve({ data: null }),
    supabase.from("crews").select("id, name, crew_code").order("crew_code"),
    supabase
      .from("activity_log")
      .select("*")
      .eq("entity_type", "job")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const member = memberRes.data as Member | null;
  const property = propertyRes.data as Property | null;
  const quote = quoteRes.data as Pick<
    Quote,
    "id" | "quote_number" | "total" | "status"
  > | null;
  const crew = crewRes.data as Crew | null;
  const allCrews = (allCrewsRes.data ?? []) as Pick<
    Crew,
    "id" | "name" | "crew_code"
  >[];
  const activity = (activityRes.data ?? []) as ActivityEntry[];
  const profileMap = Object.fromEntries(
    ((profilesRes.data ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"],
    ),
  );
  const address = property
    ? [property.street, property.city, property.state, property.zip]
        .filter(Boolean)
        .join(", ")
    : "—";

  const canSchedule = canScheduleJob(session.roles);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title={job.job_number ?? "Job"}
        description={
          member
            ? `${member.first_name} ${member.last_name} · ${address}`
            : address
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={JOB_STATUS_VARIANTS[job.status]}>
              {JOB_STATUS_LABELS[job.status]}
            </Badge>
            <Badge variant={JOB_PRIORITY_VARIANTS[job.priority]}>
              {JOB_PRIORITY_LABELS[job.priority]}
            </Badge>
            {quote ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/quotes/${quote.id}`}>{quote.quote_number}</Link>
              </Button>
            ) : null}
            <JobStatusActions job={job} canSchedule={canSchedule} />
          </div>
        }
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="completion">Completion</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="label-mono">Summary</p>
                <CardTitle>At a glance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label="Type"
                  value={job.job_type ? JOB_TYPE_LABELS[job.job_type] : "—"}
                />
                <Row label="Quoted" value={formatCents(job.quoted_cents)} />
                <Row label="Final" value={formatCents(job.final_cents)} />
                <Row label="Crew" value={crew ? `${crew.crew_code} · ${crew.name}` : "Unassigned"} />
                <Row
                  label="Scheduled start"
                  value={formatDateTime(job.scheduled_start)}
                />
                <Row
                  label="Scheduled end"
                  value={formatDateTime(job.scheduled_end)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <p className="label-mono">Member</p>
                <CardTitle>
                  {member ? `${member.first_name} ${member.last_name}` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-brand-muted">{member?.email ?? "—"}</p>
                <p className="text-brand-muted">{member?.phone ?? "—"}</p>
                <p className="text-brand-muted">{address}</p>
                {member ? (
                  <Link
                    href={`/members/${member.id}`}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Member profile →
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scope">
          <Card>
            <CardHeader>
              <p className="label-mono">Scope</p>
              <CardTitle>What crews will deliver</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-brand-primary">
                {job.scope_summary ?? "No scope summary yet."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <JobScheduleCard
            job={job}
            crews={allCrews}
            canSchedule={canSchedule}
          />
        </TabsContent>

        <TabsContent value="photos">
          <PhotoGrid
            urls={job.completion_photo_urls ?? []}
            emptyMessage="No completion photos yet."
          />
        </TabsContent>

        <TabsContent value="completion">
          <Card>
            <CardHeader>
              <p className="label-mono">Completion</p>
              <CardTitle>
                {job.status === "completed"
                  ? "Signed off"
                  : "Not yet completed"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {job.status === "completed" ? (
                <>
                  <Row label="Completed" value={formatDateTime(job.actual_end)} />
                  <div>
                    <p className="label-mono">Notes</p>
                    <p className="mt-1 whitespace-pre-line text-brand-primary">
                      {job.completion_notes ?? "—"}
                    </p>
                  </div>
                  {job.member_signature_url ? (
                    <div>
                      <p className="label-mono">Member signature</p>
                      <div className="mt-2 w-60 rounded border border-brand-border bg-brand-bg p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={job.member_signature_url}
                          alt="Signature"
                          className="h-24 w-full object-contain"
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-brand-muted">
                    Record photos, notes, and a member signature in the mobile
                    completion flow.
                  </p>
                  <Button asChild size="sm" variant="accent">
                    <Link href={`/jobs/${job.id}/complete`}>
                      Open completion flow
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTimeline events={activity} authorNames={profileMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="label-mono">{label}</p>
      <p className="text-brand-primary">{value ?? "—"}</p>
    </div>
  );
}

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
