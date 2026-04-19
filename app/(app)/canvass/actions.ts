"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canEditLead,
  canManageTerritories,
  canWorkLeads,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/types";

const territorySchema = z.object({
  name: z.string().min(2).max(120),
  zip_codes: z.string().optional(),
  total_doors: z.coerce.number().int().min(0).max(1_000_000).optional(),
  active: z.boolean().optional(),
});

export async function upsertTerritory(
  territoryId: string | null,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  if (!canManageTerritories(session.roles)) {
    throw new Error("You don't have permission to manage territories.");
  }
  if (!session.opcoId) {
    throw new Error("Your profile is not attached to an OpCo.");
  }

  const parsed = territorySchema.safeParse({
    name: (formData.get("name") as string) ?? "",
    zip_codes: (formData.get("zip_codes") as string) ?? "",
    total_doors: (formData.get("total_doors") as string) || undefined,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const zipList = (parsed.data.zip_codes ?? "")
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

  const row = {
    opco_id: session.opcoId,
    name: parsed.data.name,
    zip_codes: zipList.length ? zipList : null,
    total_doors: parsed.data.total_doors ?? null,
    active: parsed.data.active ?? true,
  };

  const supabase = await createClient();

  let id = territoryId;
  if (territoryId) {
    const { data: before } = await supabase
      .from("territories")
      .select("zip_codes")
      .eq("id", territoryId)
      .maybeSingle();
    const { error } = await supabase
      .from("territories")
      .update(row)
      .eq("id", territoryId);
    if (error) throw new Error(error.message);

    await logActivity({
      opcoId: session.opcoId,
      userId: session.userId,
      entityType: "territory",
      entityId: territoryId,
      action: "territory.updated",
      detail: { name: parsed.data.name, zip_codes: zipList },
    });

    const prevZips = (before?.zip_codes ?? []) as string[];
    if (JSON.stringify([...prevZips].sort()) !== JSON.stringify([...zipList].sort())) {
      await logActivity({
        opcoId: session.opcoId,
        userId: session.userId,
        entityType: "territory",
        entityId: territoryId,
        action: "territory.zip_codes_changed",
        detail: { from: prevZips, to: zipList },
      });
    }
  } else {
    const { data, error } = await supabase
      .from("territories")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create territory");
    }
    const newId: string = data.id;
    id = newId;
    await logActivity({
      opcoId: session.opcoId,
      userId: session.userId,
      entityType: "territory",
      entityId: newId,
      action: "territory.created",
      detail: { name: parsed.data.name, zip_codes: zipList },
    });
  }

  revalidatePath("/canvass/territories");
  if (id) revalidatePath(`/canvass/territories/${id}`);
}

const leadSchema = z.object({
  address: z.string().min(3).max(200),
  territory_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createLead(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!canWorkLeads(session.roles)) {
    throw new Error("You don't have permission to create leads.");
  }
  if (!session.opcoId) throw new Error("No OpCo assigned.");

  const parsed = leadSchema.safeParse({
    address: (formData.get("address") as string) ?? "",
    territory_id: (formData.get("territory_id") as string) ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("canvass_leads")
    .insert({
      opco_id: session.opcoId,
      address: parsed.data.address,
      territory_id: parsed.data.territory_id || null,
      status: "cold",
      attempt_count: 0,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create lead");
  }

  await logActivity({
    opcoId: session.opcoId,
    userId: session.userId,
    entityType: "lead",
    entityId: data.id,
    action: "lead.created",
    detail: { address: parsed.data.address },
  });

  revalidatePath("/canvass");
  if (parsed.data.territory_id) {
    revalidatePath(`/canvass/territories/${parsed.data.territory_id}`);
  }
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  note?: string,
): Promise<void> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("canvass_leads")
    .select("id, opco_id, status, attempt_count, contacted_by")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) throw new Error("Lead not found");
  if (
    !canEditLead(
      session.roles,
      { contacted_by: lead.contacted_by },
      session.userId,
    )
  ) {
    throw new Error("You don't have permission to update this lead.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("canvass_leads")
    .update({
      status,
      contacted_at: now,
      contacted_by: lead.contacted_by ?? session.userId,
      attempt_count: (lead.attempt_count ?? 0) + 1,
      last_notes: note?.trim() ? note.trim() : undefined,
      updated_at: now,
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: lead.opco_id,
    userId: session.userId,
    entityType: "lead",
    entityId: leadId,
    action: "lead.status_changed",
    detail: { from: lead.status, to: status },
  });

  if (note?.trim()) {
    await supabase.from("notes").insert({
      opco_id: lead.opco_id,
      entity_type: "lead",
      entity_id: leadId,
      body: note.trim(),
      created_by: session.userId,
    });
  }

  revalidatePath("/canvass");
  revalidatePath(`/canvass/leads/${leadId}`);
}
