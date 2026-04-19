import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canCompleteAppointment } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  Appointment,
  CanvassLead,
  Member,
  Profile,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentStatusBadge } from "@/components/status-badges";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { StatusTransitionBar } from "./status-transition-bar";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: apptData } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const appointment = apptData as Appointment | null;
  if (!appointment) notFound();

  const [memberRes, leadRes, assignedRes, activityRes] = await Promise.all([
    appointment.member_id
      ? supabase
          .from("members")
          .select("id, first_name, last_name")
          .eq("id", appointment.member_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    appointment.lead_id
      ? supabase
          .from("canvass_leads")
          .select("id, address")
          .eq("id", appointment.lead_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    appointment.assigned_to
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", appointment.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("activity_log")
      .select("*")
      .eq("entity_type", "appointment")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const member = memberRes.data as Pick<
    Member,
    "id" | "first_name" | "last_name"
  > | null;
  const lead = leadRes.data as Pick<CanvassLead, "id" | "address"> | null;
  const assigned = assignedRes.data as Pick<
    Profile,
    "id" | "full_name" | "email"
  > | null;
  const activity = (activityRes.data ?? []) as ActivityEntry[];

  const authorIds = new Set<string>();
  activity.forEach((a) => a.user_id && authorIds.add(a.user_id));
  if (appointment.booked_by) authorIds.add(appointment.booked_by);
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

  const canEdit = canCompleteAppointment(
    session.roles,
    {
      assigned_to: appointment.assigned_to,
      booked_by: appointment.booked_by,
    },
    session.userId,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Appointment"
        title={`${APPOINTMENT_TYPE_LABELS[appointment.type]} · ${formatDateTime(
          appointment.scheduled_for,
        )}`}
        description={`Status: ${APPOINTMENT_STATUS_LABELS[appointment.status]}`}
        actions={<AppointmentStatusBadge status={appointment.status} />}
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="label-mono">Attendee</p>
            <CardTitle>
              {member ? (
                <Link
                  href={`/members/${member.id}`}
                  className="hover:underline"
                >
                  {member.first_name} {member.last_name}
                </Link>
              ) : lead ? (
                <Link
                  href={`/canvass/leads/${lead.id}`}
                  className="hover:underline"
                >
                  {lead.address}
                </Link>
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="label-mono">Assigned to</p>
            <CardTitle>
              {assigned?.full_name ?? assigned?.email ?? "Unassigned"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="label-mono">Duration</p>
            <CardTitle>
              {appointment.duration_minutes
                ? `${appointment.duration_minutes} min`
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {appointment.notes ? (
        <Card className="mt-6">
          <CardHeader>
            <p className="label-mono">Notes</p>
            <CardTitle className="text-base">{appointment.notes}</CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="mt-6">
          <CardHeader>
            <p className="label-mono">Transition</p>
            <CardTitle>Change status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTransitionBar
              appointmentId={appointment.id}
              current={appointment.status}
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-10">
        <h2 className="font-serif text-xl font-light text-brand-primary">
          Activity
        </h2>
        <div className="mt-3">
          <ActivityTimeline events={activity} authorNames={authorNames} />
        </div>
      </section>
    </div>
  );
}
