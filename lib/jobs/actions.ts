"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { canScheduleJob } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Job, JobPriority, JobStatus } from "@/lib/types";

const scheduleSchema = z.object({
  id: z.string().uuid(),
  crew_id: z.string().uuid().nullable(),
  scheduled_start: z.string().nullable(),
  scheduled_end: z.string().nullable(),
});

export async function scheduleJob(input: z.infer<typeof scheduleSchema>) {
  const session = await requireSession();
  if (!canScheduleJob(session.roles)) {
    throw new Error("Not authorized to schedule jobs");
  }
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, opco_id, status, crew_id")
    .eq("id", parsed.data.id)
    .maybeSingle<Pick<Job, "id" | "opco_id" | "status" | "crew_id">>();
  if (!job) throw new Error("Job not found");

  const nextStatus: JobStatus =
    parsed.data.scheduled_start && parsed.data.crew_id
      ? job.status === "in_progress"
        ? "in_progress"
        : "scheduled"
      : "ready_to_schedule";

  const { error } = await supabase
    .from("jobs")
    .update({
      crew_id: parsed.data.crew_id,
      scheduled_start: parsed.data.scheduled_start,
      scheduled_end: parsed.data.scheduled_end,
      status: nextStatus,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  if (parsed.data.crew_id && parsed.data.crew_id !== job.crew_id) {
    await logActivity({
      opcoId: job.opco_id,
      userId: session.userId,
      entityType: "job",
      entityId: job.id,
      action: "job.crew_assigned",
      detail: { crew_id: parsed.data.crew_id },
    });
  }
  if (parsed.data.scheduled_start) {
    await logActivity({
      opcoId: job.opco_id,
      userId: session.userId,
      entityType: "job",
      entityId: job.id,
      action: "job.scheduled",
      detail: {
        scheduled_start: parsed.data.scheduled_start,
        scheduled_end: parsed.data.scheduled_end,
      },
    });
  }
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/jobs");
  revalidatePath("/schedule");
}

const scopeSchema = z.object({
  id: z.string().uuid(),
  scope_summary: z.string().max(4000).nullable(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  job_type: z
    .enum(["repair", "replacement", "rejuvenation", "maintenance", "inspection_followup"])
    .nullable()
    .optional(),
});

export async function updateJobScope(input: z.infer<typeof scopeSchema>) {
  const session = await requireSession();
  if (!canScheduleJob(session.roles)) {
    throw new Error("Not authorized");
  }
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from("jobs").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/jobs/${id}`);
}

export async function startJob(jobId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, opco_id, status")
    .eq("id", jobId)
    .maybeSingle<Pick<Job, "id" | "opco_id" | "status">>();
  if (!job) throw new Error("Job not found");
  if (job.status === "completed" || job.status === "cancelled") {
    throw new Error(`Job is ${job.status}`);
  }
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "in_progress",
      actual_start: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
  await logActivity({
    opcoId: job.opco_id,
    userId: session.userId,
    entityType: "job",
    entityId: job.id,
    action: "job.started",
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

const completeSchema = z.object({
  id: z.string().uuid(),
  completion_notes: z.string().max(4000).nullable().optional(),
  completion_photo_urls: z.array(z.string().url()).optional(),
  member_signature_url: z.string().url().nullable().optional(),
  final_cents: z.number().int().nonnegative().nullable().optional(),
});

export async function completeJob(input: z.infer<typeof completeSchema>) {
  const session = await requireSession();
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, opco_id, status, opportunity_id")
    .eq("id", parsed.data.id)
    .maybeSingle<
      Pick<Job, "id" | "opco_id" | "status" | "opportunity_id">
    >();
  if (!job) throw new Error("Job not found");

  const { id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("jobs")
    .update({
      ...rest,
      status: "completed",
      actual_end: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (job.opportunity_id) {
    await supabase
      .from("opportunities")
      .update({ stage: "completed", closed_at: new Date().toISOString() })
      .eq("id", job.opportunity_id);
  }

  await logActivity({
    opcoId: job.opco_id,
    userId: session.userId,
    entityType: "job",
    entityId: job.id,
    action: "job.completed",
  });
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/schedule");
}

export async function cancelJob(jobId: string, reason?: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, opco_id")
    .eq("id", jobId)
    .maybeSingle<Pick<Job, "id" | "opco_id">>();
  if (!job) throw new Error("Job not found");
  const { error } = await supabase
    .from("jobs")
    .update({ status: "cancelled", completion_notes: reason ?? null })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
  await logActivity({
    opcoId: job.opco_id,
    userId: session.userId,
    entityType: "job",
    entityId: job.id,
    action: "job.cancelled",
    detail: reason ? { reason } : undefined,
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export type { JobPriority, JobStatus };
