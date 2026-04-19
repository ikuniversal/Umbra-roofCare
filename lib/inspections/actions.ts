"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canAddInspectionFinding,
  canCaptureInspection,
  canScheduleInspection,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { FINDING_SEVERITY_ORDER } from "@/lib/labels";
import { evaluateInspection } from "@/lib/decision-engine";
import {
  DEFAULT_CHECKPOINTS,
  DEFAULT_TEMPLATE_NAME,
} from "@/lib/inspections/template";
import { mergeResults, scoreInspection } from "@/lib/inspections/scoring";
import type {
  CheckpointRating,
  CheckpointResult,
  FindingSeverity,
  Inspection,
  InspectionTemplate,
  TemplateCheckpoint,
} from "@/lib/types";

const scheduleSchema = z.object({
  member_id: z.string().uuid(),
  property_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional().or(z.literal("")),
  inspector_id: z.string().uuid().optional().or(z.literal("")),
  scheduled_for: z.string().min(1),
  notes: z.string().max(400).optional().or(z.literal("")),
});

export async function scheduleInspection(formData: FormData): Promise<string> {
  const session = await requireSession();
  if (!canScheduleInspection(session.roles)) {
    throw new Error("You don't have permission to schedule inspections.");
  }
  const parsed = scheduleSchema.safeParse({
    member_id: formData.get("member_id") ?? "",
    property_id: formData.get("property_id") ?? "",
    appointment_id: formData.get("appointment_id") ?? "",
    inspector_id: formData.get("inspector_id") ?? "",
    scheduled_for: formData.get("scheduled_for") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid data");
  }

  const supabase = await createClient();

  const template = await ensureDefaultTemplate(supabase, session.opcoId);

  const { data: inserted, error } = await supabase
    .from("inspections")
    .insert({
      opco_id: session.opcoId,
      member_id: parsed.data.member_id,
      property_id: parsed.data.property_id,
      appointment_id: parsed.data.appointment_id || null,
      inspector_id: parsed.data.inspector_id || session.userId,
      template_id: template.id,
      template_version: template.version,
      scheduled_for: new Date(parsed.data.scheduled_for).toISOString(),
      notes: parsed.data.notes || null,
      status: "scheduled",
      checkpoint_results: mergeResults(template.checkpoints, []),
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to schedule inspection");
  }

  await logActivity({
    opcoId: session.opcoId,
    userId: session.userId,
    entityType: "inspection",
    entityId: inserted.id,
    action: "inspection.scheduled",
    detail: {
      member_id: parsed.data.member_id,
      scheduled_for: parsed.data.scheduled_for,
    },
  });

  revalidatePath("/inspections");
  return inserted.id;
}

const rateSchema = z.object({
  inspection_id: z.string().uuid(),
  checkpoint_id: z.string().min(1),
  rating: z.enum(["pass", "warn", "fail"]),
  notes: z.string().max(400).optional().or(z.literal("")),
});

export async function rateCheckpoint(input: {
  inspectionId: string;
  checkpointId: string;
  rating: CheckpointRating;
  notes?: string;
}) {
  const session = await requireSession();
  const parsed = rateSchema.safeParse({
    inspection_id: input.inspectionId,
    checkpoint_id: input.checkpointId,
    rating: input.rating,
    notes: input.notes ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid rating");
  }

  const supabase = await createClient();
  const { inspection, template } = await loadInspectionWithTemplate(
    supabase,
    parsed.data.inspection_id,
  );

  if (
    !canCaptureInspection(
      session.roles,
      { inspector_id: inspection.inspector_id, status: inspection.status },
      session.userId,
    )
  ) {
    throw new Error("You don't have permission to rate this inspection.");
  }

  const merged = mergeResults(template.checkpoints, inspection.checkpoint_results);
  const next: CheckpointResult[] = merged.map((r) =>
    r.checkpoint_id === parsed.data.checkpoint_id
      ? {
          ...r,
          rating: parsed.data.rating,
          notes: parsed.data.notes || r.notes,
        }
      : r,
  );

  const breakdown = scoreInspection(template.checkpoints, next);
  const isInProgress = inspection.status === "scheduled";

  const update: Partial<Inspection> & { status: string } = {
    checkpoint_results: next,
    overall_score: breakdown.score,
    condition_band: breakdown.band,
    recommended_action: breakdown.action,
    score_breakdown: breakdown.byCategory as unknown as Record<string, number>,
    status: isInProgress ? "in_progress" : inspection.status,
    started_at: isInProgress
      ? new Date().toISOString()
      : (inspection.started_at ?? null),
  };

  const { error } = await supabase
    .from("inspections")
    .update(update)
    .eq("id", inspection.id);

  if (error) throw new Error(error.message);

  if (isInProgress) {
    await logActivity({
      opcoId: inspection.opco_id,
      userId: session.userId,
      entityType: "inspection",
      entityId: inspection.id,
      action: "inspection.started",
    });
  }

  revalidatePath(`/inspections/${inspection.id}`);
  revalidatePath(`/inspections/${inspection.id}/capture`);
}

export async function addCheckpointPhoto(input: {
  inspectionId: string;
  checkpointId: string;
  photoUrl: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const { inspection, template } = await loadInspectionWithTemplate(
    supabase,
    input.inspectionId,
  );
  if (
    !canCaptureInspection(
      session.roles,
      { inspector_id: inspection.inspector_id, status: inspection.status },
      session.userId,
    )
  ) {
    throw new Error("Not authorized");
  }

  const merged = mergeResults(template.checkpoints, inspection.checkpoint_results);
  const next = merged.map((r) =>
    r.checkpoint_id === input.checkpointId
      ? { ...r, photo_urls: [...(r.photo_urls ?? []), input.photoUrl] }
      : r,
  );

  const { error } = await supabase
    .from("inspections")
    .update({ checkpoint_results: next })
    .eq("id", inspection.id);

  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: inspection.opco_id,
    userId: session.userId,
    entityType: "inspection",
    entityId: inspection.id,
    action: "inspection.photo_uploaded",
    detail: { checkpoint: input.checkpointId },
  });

  revalidatePath(`/inspections/${inspection.id}`);
  revalidatePath(`/inspections/${inspection.id}/capture`);
}

const findingSchema = z.object({
  inspection_id: z.string().uuid(),
  category: z.string().min(1).max(60),
  severity: z.enum(
    FINDING_SEVERITY_ORDER as [FindingSeverity, ...FindingSeverity[]],
  ),
  description: z.string().min(1).max(400),
  location: z.string().max(80).optional().or(z.literal("")),
  estimated_repair_cents: z.coerce.number().int().min(0).optional(),
  photo_urls: z.array(z.string().url()).optional(),
});

export async function addFinding(input: {
  inspectionId: string;
  category: string;
  severity: FindingSeverity;
  description: string;
  location?: string;
  estimatedRepairCents?: number;
  photoUrls?: string[];
}) {
  const session = await requireSession();
  const parsed = findingSchema.safeParse({
    inspection_id: input.inspectionId,
    category: input.category,
    severity: input.severity,
    description: input.description,
    location: input.location ?? "",
    estimated_repair_cents: input.estimatedRepairCents ?? 0,
    photo_urls: input.photoUrls ?? [],
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid finding");
  }

  const supabase = await createClient();
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, inspector_id, status, opco_id")
    .eq("id", parsed.data.inspection_id)
    .maybeSingle<Pick<Inspection, "id" | "inspector_id" | "status" | "opco_id">>();

  if (!inspection) throw new Error("Inspection not found");

  if (
    !canAddInspectionFinding(
      session.roles,
      { inspector_id: inspection.inspector_id, status: inspection.status },
      session.userId,
    )
  ) {
    throw new Error("Not authorized");
  }

  const { error } = await supabase.from("inspection_findings").insert({
    inspection_id: inspection.id,
    category: parsed.data.category,
    severity: parsed.data.severity,
    description: parsed.data.description,
    location: parsed.data.location || null,
    estimated_repair_cents: parsed.data.estimated_repair_cents || null,
    photo_urls: parsed.data.photo_urls ?? [],
  });

  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: inspection.opco_id,
    userId: session.userId,
    entityType: "inspection",
    entityId: inspection.id,
    action: "inspection.finding_added",
    detail: {
      severity: parsed.data.severity,
      category: parsed.data.category,
    },
  });

  revalidatePath(`/inspections/${inspection.id}`);
}

export async function completeInspection(input: {
  inspectionId: string;
  weather?: string;
  heroPhotoUrls?: string[];
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const { inspection, template } = await loadInspectionWithTemplate(
    supabase,
    input.inspectionId,
  );

  if (
    !canCaptureInspection(
      session.roles,
      { inspector_id: inspection.inspector_id, status: inspection.status },
      session.userId,
    )
  ) {
    throw new Error("Not authorized");
  }

  const merged = mergeResults(template.checkpoints, inspection.checkpoint_results);
  const breakdown = scoreInspection(template.checkpoints, merged);
  if (breakdown.answered < template.checkpoints.length) {
    throw new Error(
      `Rate every checkpoint before completing (${breakdown.answered}/${template.checkpoints.length}).`,
    );
  }

  const completedAt = new Date().toISOString();
  const durationMinutes = inspection.started_at
    ? Math.max(
        1,
        Math.round(
          (new Date(completedAt).getTime() -
            new Date(inspection.started_at).getTime()) /
            60000,
        ),
      )
    : null;

  const { error } = await supabase
    .from("inspections")
    .update({
      status: "completed",
      completed_at: completedAt,
      duration_minutes: durationMinutes,
      overall_score: breakdown.score,
      condition_band: breakdown.band,
      recommended_action: breakdown.action,
      score_breakdown: breakdown.byCategory as unknown as Record<string, number>,
      weather_at_inspection: input.weather || inspection.weather_at_inspection,
      photos_manifest: {
        hero_photo_urls: input.heroPhotoUrls ?? [],
      },
    })
    .eq("id", inspection.id);

  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: inspection.opco_id,
    userId: session.userId,
    entityType: "inspection",
    entityId: inspection.id,
    action: "inspection.completed",
    detail: {
      score: breakdown.score,
      band: breakdown.band,
    },
  });

  // Fire the decision engine. Don't block completion on failure — operator
  // can always re-run from the detail page.
  try {
    await evaluateInspection(inspection.id);
  } catch (err) {
    console.error("[inspection] decision engine failed", err);
  }

  revalidatePath(`/inspections/${inspection.id}`);
  revalidatePath("/inspections");
  revalidatePath("/inspections/queue");
}

export async function replayDecisionEngine(inspectionId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: insp } = await supabase
    .from("inspections")
    .select("id, opco_id, status, inspector_id")
    .eq("id", inspectionId)
    .maybeSingle<Pick<Inspection, "id" | "opco_id" | "status" | "inspector_id">>();
  if (!insp) throw new Error("Inspection not found");
  if (insp.status !== "completed") {
    throw new Error("Only completed inspections can replay the engine.");
  }
  if (
    !canCaptureInspection(
      session.roles,
      { inspector_id: insp.inspector_id, status: "in_progress" },
      session.userId,
    )
  ) {
    // canCaptureInspection returns false for completed inspections by
    // design; we explicitly allow replay for OpCo managers + platform
    // admins.
    const { isPlatformAdmin, hasRole } = await import("@/lib/rbac");
    const allowed =
      isPlatformAdmin(session.roles) ||
      hasRole(session.roles, [
        "opco_gm",
        "sales_manager",
        "area_manager",
        "team_lead",
      ]);
    if (!allowed) throw new Error("Not authorized");
  }

  const result = await evaluateInspection(inspectionId);
  revalidatePath(`/inspections/${inspectionId}`);
  return result;
}

async function ensureDefaultTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opcoId: string | null,
): Promise<InspectionTemplate> {
  const { data: existing } = await supabase
    .from("inspection_templates")
    .select("*")
    .eq("name", DEFAULT_TEMPLATE_NAME)
    .or(`opco_id.is.null${opcoId ? `,opco_id.eq.${opcoId}` : ""}`)
    .order("opco_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<InspectionTemplate>();

  if (existing) return existing;

  const { data: inserted, error } = await supabase
    .from("inspection_templates")
    .insert({
      opco_id: null,
      name: DEFAULT_TEMPLATE_NAME,
      version: 1,
      active: true,
      checkpoints: DEFAULT_CHECKPOINTS,
    })
    .select("*")
    .maybeSingle<InspectionTemplate>();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Could not provision default template");
  }
  return inserted;
}

async function loadInspectionWithTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inspectionId: string,
): Promise<{ inspection: Inspection; template: InspectionTemplate }> {
  const { data: insp, error } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", inspectionId)
    .maybeSingle<Inspection>();

  if (error || !insp) throw new Error(error?.message ?? "Inspection not found");

  let template: InspectionTemplate | null = null;
  if (insp.template_id) {
    const { data: tpl } = await supabase
      .from("inspection_templates")
      .select("*")
      .eq("id", insp.template_id)
      .maybeSingle<InspectionTemplate>();
    template = tpl ?? null;
  }
  if (!template) {
    template = await ensureDefaultTemplate(supabase, insp.opco_id);
  }

  const checkpoints: TemplateCheckpoint[] =
    template.checkpoints && Array.isArray(template.checkpoints)
      ? (template.checkpoints as TemplateCheckpoint[])
      : DEFAULT_CHECKPOINTS;

  return {
    inspection: insp,
    template: { ...template, checkpoints },
  };
}
