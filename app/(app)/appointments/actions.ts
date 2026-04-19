"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canBookAppointment,
  canCompleteAppointment,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";

const schema = z.object({
  type: z.enum([
    "enrollment",
    "inspection",
    "consultation",
    "service_quote",
    "follow_up",
  ]),
  scheduled_date: z.string().min(1),
  scheduled_time: z.string().min(1),
  duration_minutes: z.coerce.number().int().min(15).max(480),
  member_id: z.string().uuid().optional().or(z.literal("")),
  lead_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function createAppointment(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!canBookAppointment(session.roles)) {
    throw new Error("You don't have permission to book appointments.");
  }
  if (!session.opcoId) throw new Error("No OpCo assigned.");

  const parsed = schema.safeParse({
    type: formData.get("type"),
    scheduled_date: formData.get("scheduled_date"),
    scheduled_time: formData.get("scheduled_time"),
    duration_minutes: formData.get("duration_minutes") || "60",
    member_id: formData.get("member_id"),
    lead_id: formData.get("lead_id"),
    assigned_to: formData.get("assigned_to"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  if (!parsed.data.member_id && !parsed.data.lead_id) {
    throw new Error("Select a member or a lead for this appointment.");
  }

  const scheduledFor = new Date(
    `${parsed.data.scheduled_date}T${parsed.data.scheduled_time}:00`,
  );
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Invalid date/time.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      opco_id: session.opcoId,
      type: parsed.data.type,
      scheduled_for: scheduledFor.toISOString(),
      duration_minutes: parsed.data.duration_minutes,
      member_id: parsed.data.member_id || null,
      lead_id: parsed.data.lead_id || null,
      assigned_to: parsed.data.assigned_to || session.userId,
      booked_by: session.userId,
      status: "scheduled",
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create appointment");
  }

  await logActivity({
    opcoId: session.opcoId,
    userId: session.userId,
    entityType: "appointment",
    entityId: data.id,
    action: "appointment.scheduled",
    detail: {
      type: parsed.data.type,
      scheduled_for: scheduledFor.toISOString(),
    },
  });

  revalidatePath("/appointments");
  redirect(`/appointments/${data.id}`);
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<void> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, opco_id, status, assigned_to, booked_by, member_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) throw new Error("Appointment not found");
  if (
    !canCompleteAppointment(
      session.roles,
      { assigned_to: appt.assigned_to, booked_by: appt.booked_by },
      session.userId,
    )
  ) {
    throw new Error("You don't have permission to change this appointment.");
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);
  if (error) throw new Error(error.message);

  const actionMap: Record<AppointmentStatus, string> = {
    scheduled: "appointment.scheduled",
    confirmed: "appointment.scheduled",
    rescheduled: "appointment.rescheduled",
    completed: "appointment.completed",
    cancelled: "appointment.cancelled",
    no_show: "appointment.no_show",
  };
  await logActivity({
    opcoId: appt.opco_id,
    userId: session.userId,
    entityType: "appointment",
    entityId: appointmentId,
    action: actionMap[status],
    detail: { from: appt.status, to: status },
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
  if (appt.member_id) revalidatePath(`/members/${appt.member_id}`);
}
