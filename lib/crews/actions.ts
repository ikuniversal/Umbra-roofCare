"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { canManageCrews } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  crew_code: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[A-Z0-9-]+$/, "Uppercase letters, digits, and dashes only"),
  lead_id: z.string().uuid().nullable().optional(),
  specialties: z.array(z.string()).optional(),
  max_concurrent_jobs: z.number().int().positive().optional(),
  home_base: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function createCrew(input: z.infer<typeof createSchema>) {
  const session = await requireSession();
  if (!canManageCrews(session.roles)) {
    throw new Error("Not authorized to manage crews");
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  if (!session.opcoId) throw new Error("No OpCo in context");
  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("crews")
    .insert({
      opco_id: session.opcoId,
      name: parsed.data.name,
      crew_code: parsed.data.crew_code,
      lead_id: parsed.data.lead_id ?? null,
      specialties: parsed.data.specialties ?? [],
      max_concurrent_jobs: parsed.data.max_concurrent_jobs ?? 1,
      home_base: parsed.data.home_base ?? null,
      notes: parsed.data.notes ?? null,
      active: true,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !inserted) {
    throw new Error(error?.message ?? "Create failed");
  }
  await logActivity({
    opcoId: session.opcoId,
    userId: session.userId,
    entityType: "crew",
    entityId: inserted.id,
    action: "crew.created",
    detail: { crew_code: parsed.data.crew_code },
  });
  revalidatePath("/crews");
  return inserted.id;
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  lead_id: z.string().uuid().nullable().optional(),
  specialties: z.array(z.string()).optional(),
  max_concurrent_jobs: z.number().int().positive().optional(),
  home_base: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

export async function updateCrew(input: z.infer<typeof updateSchema>) {
  const session = await requireSession();
  if (!canManageCrews(session.roles)) {
    throw new Error("Not authorized");
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from("crews").update(rest).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/crews/${id}`);
  revalidatePath("/crews");
}

export async function addCrewMember(input: {
  crew_id: string;
  profile_id: string;
  role?: "lead" | "tech" | "helper";
}) {
  const session = await requireSession();
  if (!canManageCrews(session.roles)) {
    throw new Error("Not authorized");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("crew_members").insert({
    crew_id: input.crew_id,
    profile_id: input.profile_id,
    role: input.role ?? "tech",
  });
  if (error) throw new Error(error.message);
  await logActivity({
    opcoId: session.opcoId,
    userId: session.userId,
    entityType: "crew",
    entityId: input.crew_id,
    action: "crew.member_added",
    detail: { profile_id: input.profile_id, role: input.role ?? "tech" },
  });
  revalidatePath(`/crews/${input.crew_id}`);
}

export async function removeCrewMember(input: {
  crew_id: string;
  member_row_id: string;
}) {
  const session = await requireSession();
  if (!canManageCrews(session.roles)) {
    throw new Error("Not authorized");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("crew_members")
    .update({ left_at: new Date().toISOString().slice(0, 10) })
    .eq("id", input.member_row_id);
  if (error) throw new Error(error.message);
  await logActivity({
    opcoId: session.opcoId,
    userId: session.userId,
    entityType: "crew",
    entityId: input.crew_id,
    action: "crew.member_removed",
  });
  revalidatePath(`/crews/${input.crew_id}`);
}

const availabilitySchema = z.object({
  crew_id: z.string().uuid(),
  kind: z.enum(["working_hours", "time_off", "holiday"]),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
});

export async function addAvailability(
  input: z.infer<typeof availabilitySchema>,
) {
  const session = await requireSession();
  if (!canManageCrews(session.roles)) {
    throw new Error("Not authorized");
  }
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("crew_availability").insert(parsed.data);
  if (error) throw new Error(error.message);
  revalidatePath(`/crews/${parsed.data.crew_id}`);
  revalidatePath("/schedule");
}

export async function removeAvailability(input: {
  id: string;
  crew_id: string;
}) {
  const session = await requireSession();
  if (!canManageCrews(session.roles)) {
    throw new Error("Not authorized");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("crew_availability")
    .delete()
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/crews/${input.crew_id}`);
  revalidatePath("/schedule");
}
