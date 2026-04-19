import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canEditLead } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  CanvassLead,
  NoteEntry,
  Profile,
  Territory,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/status-badges";
import { NotesPanel } from "@/components/notes-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { LeadStatusControl } from "./lead-status-control";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: leadData } = await supabase
    .from("canvass_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const lead = leadData as CanvassLead | null;
  if (!lead) notFound();

  const [territoryRes, notesRes, activityRes] = await Promise.all([
    lead.territory_id
      ? supabase
          .from("territories")
          .select("*")
          .eq("id", lead.territory_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("notes")
      .select("*")
      .eq("entity_type", "lead")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("*")
      .eq("entity_type", "lead")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const territory = (territoryRes.data ?? null) as Territory | null;
  const notes = (notesRes.data ?? []) as NoteEntry[];
  const activity = (activityRes.data ?? []) as ActivityEntry[];

  const authorIds = new Set<string>();
  notes.forEach((n) => n.created_by && authorIds.add(n.created_by));
  activity.forEach((a) => a.user_id && authorIds.add(a.user_id));
  if (lead.contacted_by) authorIds.add(lead.contacted_by);
  const authorNames: Record<string, string> = {};
  if (authorIds.size > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(authorIds));
    ((authors ?? []) as Profile[]).forEach((p) => {
      authorNames[p.id] = p.full_name ?? p.email ?? "Unknown";
    });
  }

  const canEdit = canEditLead(
    session.roles,
    { contacted_by: lead.contacted_by },
    session.userId,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow={territory?.name ?? "Canvass lead"}
        title={lead.address}
        description={`Attempts: ${lead.attempt_count}`}
        actions={
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            {lead.converted_to_member_id ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/members/${lead.converted_to_member_id}`}>
                  View member →
                </Link>
              </Button>
            ) : lead.status === "interested" ||
              lead.status === "appointment_booked" ? (
              <Button asChild size="sm" variant="accent">
                <Link href={`/members/new?from_lead=${lead.id}`}>
                  Convert to member
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="label-mono">Assigned setter</p>
            <CardTitle>
              {lead.contacted_by
                ? authorNames[lead.contacted_by] ?? "Unknown"
                : "Unassigned"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-brand-muted">
            Last touched {lead.contacted_at ? formatDateTime(lead.contacted_at) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="label-mono">Territory</p>
            <CardTitle>{territory?.name ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-brand-muted">
            {territory?.zip_codes?.join(", ") || "No zip codes"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="label-mono">Last notes</p>
            <CardTitle className="text-sm">
              {lead.last_notes ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {canEdit ? (
        <Card className="mt-6">
          <CardHeader>
            <p className="label-mono">Update</p>
            <CardTitle>Log a new touch</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadStatusControl leadId={lead.id} currentStatus={lead.status} />
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-8">
        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <NotesPanel
              entityType="lead"
              entityId={lead.id}
              opcoId={lead.opco_id}
              userId={session.userId}
              notes={notes}
              authorNames={authorNames}
              canAdd={canEdit}
            />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTimeline events={activity} authorNames={authorNames} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
