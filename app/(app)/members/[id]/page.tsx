import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canEditMember } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  Appointment,
  Member,
  NoteEntry,
  Profile,
  Property,
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
import { MemberStatusBadge } from "@/components/status-badges";
import { NotesPanel } from "@/components/notes-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/labels";
import { formatDateTime, formatPhone } from "@/lib/utils";
import { MemberForm } from "../member-form";
import { PropertyList } from "./property-list";
import { ChangeStatusButton } from "./change-status-button";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: memberData } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const member = memberData as Member | null;
  if (!member) notFound();

  const propertiesQuery = supabase
    .from("properties")
    .select("*")
    .eq("member_id", id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  const notesQuery = supabase
    .from("notes")
    .select("*")
    .eq("entity_type", "member")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const activityQuery = supabase
    .from("activity_log")
    .select("*")
    .eq("entity_type", "member")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const appointmentsQuery = supabase
    .from("appointments")
    .select("*")
    .eq("member_id", id)
    .order("scheduled_for", { ascending: false });

  const [
    { data: properties },
    { data: notes },
    { data: activity },
    { data: appointments },
  ] = await Promise.all([
    propertiesQuery,
    notesQuery,
    activityQuery,
    appointmentsQuery,
  ]);

  const propertyList = (properties ?? []) as Property[];
  const noteList = (notes ?? []) as NoteEntry[];
  const activityList = (activity ?? []) as ActivityEntry[];
  const appointmentList = (appointments ?? []) as Appointment[];

  const authorIds = new Set<string>();
  noteList.forEach((n) => n.created_by && authorIds.add(n.created_by));
  activityList.forEach((a) => a.user_id && authorIds.add(a.user_id));
  if (member.primary_cra_id) authorIds.add(member.primary_cra_id);
  if (member.created_by) authorIds.add(member.created_by);

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

  const primary = propertyList.find((p) => p.is_primary) ?? propertyList[0] ?? null;

  const canEdit = canEditMember(
    session.roles,
    {
      primary_cra_id: member.primary_cra_id,
      created_by: member.created_by,
    },
    session.userId,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Member"
        title={`${member.first_name} ${member.last_name}`}
        description={primary?.street ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <MemberStatusBadge status={member.status} />
            {canEdit ? (
              <ChangeStatusButton
                memberId={member.id}
                current={member.status}
              />
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={`/appointments/new?member_id=${member.id}`}>
                Book appointment
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mt-8">
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="properties">
              Properties ({propertyList.length})
            </TabsTrigger>
            <TabsTrigger value="appointments">
              Appointments ({appointmentList.length})
            </TabsTrigger>
            <TabsTrigger value="notes">
              Notes ({noteList.length})
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="future">Future</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <p className="label-mono">Contact</p>
                  <CardTitle>{member.email ?? "—"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="label-mono">Phone</p>
                    <p>{formatPhone(member.phone)}</p>
                  </div>
                  <div>
                    <p className="label-mono">Preferred</p>
                    <p>{member.preferred_contact ?? "—"}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <p className="label-mono">Relationship</p>
                  <CardTitle>
                    {member.primary_cra_id
                      ? authorNames[member.primary_cra_id] ?? "Assigned CRA"
                      : "Unassigned"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="label-mono">Source</p>
                    <p>{member.source ?? "—"}</p>
                  </div>
                  <div>
                    <p className="label-mono">Created by</p>
                    <p>
                      {member.created_by
                        ? authorNames[member.created_by] ?? "Unknown"
                        : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <p className="label-mono">Tags</p>
                  <CardTitle>{member.tags?.length ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5 text-sm">
                  {member.tags?.length
                    ? member.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-brand-border-strong px-2.5 py-0.5 text-xs text-brand-muted"
                        >
                          {t}
                        </span>
                      ))
                    : <span className="text-brand-muted">None</span>}
                </CardContent>
              </Card>
            </div>

            {canEdit ? (
              <Card className="mt-6">
                <CardHeader>
                  <p className="label-mono">Edit member</p>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberForm
                    mode="edit"
                    member={member}
                    primaryProperty={primary}
                  />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="properties">
            <PropertyList
              memberId={member.id}
              properties={propertyList}
              canEdit={canEdit}
            />
          </TabsContent>

          <TabsContent value="appointments">
            {appointmentList.length === 0 ? (
              <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted">
                No appointments yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {appointmentList.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-brand-border bg-brand-card p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-serif text-base text-brand-primary">
                          {APPOINTMENT_TYPE_LABELS[a.type]}
                        </p>
                        <p className="label-mono mt-1">
                          {formatDateTime(a.scheduled_for)}
                        </p>
                      </div>
                      <Link
                        href={`/appointments/${a.id}`}
                        className="text-xs text-brand-primary underline-offset-4 hover:underline"
                      >
                        {APPOINTMENT_STATUS_LABELS[a.status]} →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="notes">
            <NotesPanel
              entityType="member"
              entityId={member.id}
              opcoId={member.opco_id}
              userId={session.userId}
              notes={noteList}
              authorNames={authorNames}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTimeline
              events={activityList}
              authorNames={authorNames}
            />
          </TabsContent>

          <TabsContent value="future">
            <div className="grid gap-3 md:grid-cols-3">
              <FuturePlaceholder phase={3} title="Inspections" />
              <FuturePlaceholder phase={4} title="Opportunities & jobs" />
              <FuturePlaceholder phase={5} title="Subscription & billing" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FuturePlaceholder({ phase, title }: { phase: number; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-brand-border-strong bg-brand-card/60 p-4">
      <p className="label-mono">Phase {phase}</p>
      <p className="mt-2 font-serif text-lg text-brand-primary">{title}</p>
      <p className="mt-1 text-xs text-brand-muted">
        Coming in Phase {phase}.
      </p>
    </div>
  );
}
