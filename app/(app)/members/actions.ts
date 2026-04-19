"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { canCreateMember, canEditMember, canManageMembers } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { MemberStatus } from "@/lib/types";

const memberSchema = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().max(30).optional().or(z.literal("")),
  preferred_contact: z
    .enum(["email", "phone", "sms"])
    .optional()
    .or(z.literal("")),
  source: z
    .enum(["canvass", "referral", "online", "event", "inbound", "partner"])
    .optional()
    .or(z.literal("")),
  status: z.enum([
    "prospect",
    "member",
    "paused",
    "cancelled",
    "churned",
  ] as const satisfies readonly MemberStatus[]),
  primary_cra_id: z.string().uuid().or(z.literal("")).optional(),
  lifecycle_stage: z.string().max(80).optional().or(z.literal("")),
  tags: z.string().optional(),
});

const propertySchema = z.object({
  street: z.string().min(1).max(160),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
  zip: z.string().max(10).optional().or(z.literal("")),
  roof_material: z
    .enum([
      "composition_shingle",
      "standing_seam_metal",
      "tile_concrete",
      "tile_clay",
      "slate",
      "wood_shake",
      "flat_membrane",
      "other",
    ])
    .optional()
    .or(z.literal("")),
  roof_age_years: z.coerce.number().int().min(0).max(120).optional(),
  square_footage: z.coerce.number().int().min(0).max(100000).optional(),
  stories: z.coerce.number().int().min(1).max(6).optional(),
  has_solar: z.boolean().optional(),
  has_skylights: z.boolean().optional(),
  has_chimney: z.boolean().optional(),
});

function nullable<T extends string>(v: T | undefined | null): T | null {
  if (!v) return null;
  return v;
}

export async function createMember(formData: FormData) {
  const session = await requireSession();
  if (!canCreateMember(session.roles)) {
    throw new Error("You don't have permission to create members.");
  }

  const memberPayload = {
    first_name: (formData.get("first_name") as string) || "",
    last_name: (formData.get("last_name") as string) || "",
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || "",
    preferred_contact: (formData.get("preferred_contact") as string) || "",
    source: (formData.get("source") as string) || "",
    status: ((formData.get("status") as string) || "prospect") as MemberStatus,
    primary_cra_id: (formData.get("primary_cra_id") as string) || "",
    lifecycle_stage: (formData.get("lifecycle_stage") as string) || "",
    tags: (formData.get("tags") as string) || "",
  };

  const parsed = memberSchema.safeParse(memberPayload);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid member data");
  }

  const propertyPayload = {
    street: (formData.get("street") as string) || "",
    city: (formData.get("city") as string) || "",
    state: (formData.get("state") as string) || "",
    zip: (formData.get("zip") as string) || "",
    roof_material: (formData.get("roof_material") as string) || "",
    roof_age_years: (formData.get("roof_age_years") as string) || undefined,
    square_footage: (formData.get("square_footage") as string) || undefined,
    stories: (formData.get("stories") as string) || undefined,
    has_solar: formData.get("has_solar") === "on",
    has_skylights: formData.get("has_skylights") === "on",
    has_chimney: formData.get("has_chimney") === "on",
  };
  const parsedProperty = propertySchema.safeParse(propertyPayload);
  if (!parsedProperty.success) {
    throw new Error(
      parsedProperty.error.errors[0]?.message ?? "Invalid property data",
    );
  }

  const supabase = await createClient();
  const opcoId = session.opcoId;
  if (!opcoId) {
    throw new Error("Your profile is not attached to an OpCo yet.");
  }

  const insertPayload = {
    opco_id: opcoId,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: nullable(parsed.data.email),
    phone: nullable(parsed.data.phone),
    preferred_contact: nullable(parsed.data.preferred_contact),
    source: nullable(parsed.data.source ?? "inbound"),
    status: parsed.data.status,
    primary_cra_id: nullable(parsed.data.primary_cra_id),
    lifecycle_stage: nullable(parsed.data.lifecycle_stage),
    tags: parsed.data.tags
      ? parsed.data.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : null,
    created_by: session.userId,
  };

  const { data: member, error } = await supabase
    .from("members")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !member) {
    throw new Error(error?.message ?? "Failed to create member");
  }

  if (parsedProperty.data.street) {
    const { error: propErr } = await supabase.from("properties").insert({
      opco_id: opcoId,
      member_id: member.id,
      is_primary: true,
      street: parsedProperty.data.street,
      city: nullable(parsedProperty.data.city),
      state: nullable(parsedProperty.data.state),
      zip: nullable(parsedProperty.data.zip),
      roof_material: nullable(parsedProperty.data.roof_material),
      roof_age_years: parsedProperty.data.roof_age_years ?? null,
      square_footage: parsedProperty.data.square_footage ?? null,
      stories: parsedProperty.data.stories ?? null,
      has_solar: parsedProperty.data.has_solar ?? false,
      has_skylights: parsedProperty.data.has_skylights ?? false,
      has_chimney: parsedProperty.data.has_chimney ?? false,
    });
    if (propErr) {
      console.error("[members] property insert failed", propErr);
    }
  }

  const convertLeadId = formData.get("from_lead_id") as string | null;
  if (convertLeadId) {
    const { error: convErr } = await supabase
      .from("canvass_leads")
      .update({ status: "signed", converted_to_member_id: member.id })
      .eq("id", convertLeadId);
    if (!convErr) {
      await logActivity({
        opcoId,
        userId: session.userId,
        entityType: "lead",
        entityId: convertLeadId,
        action: "lead.converted",
        detail: { member_id: member.id },
      });
    }
  }

  await logActivity({
    opcoId,
    userId: session.userId,
    entityType: "member",
    entityId: member.id,
    action: "member.created",
    detail: {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      status: parsed.data.status,
    },
  });

  revalidatePath("/members");
  redirect(`/members/${member.id}`);
}

export async function updateMember(memberId: string, formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("members")
    .select("id, opco_id, primary_cra_id, created_by, status")
    .eq("id", memberId)
    .maybeSingle();

  if (!existing) throw new Error("Member not found");
  if (
    !canEditMember(
      session.roles,
      {
        primary_cra_id: existing.primary_cra_id,
        created_by: existing.created_by,
      },
      session.userId,
    )
  ) {
    throw new Error("You don't have permission to edit this member.");
  }

  const payload = {
    first_name: (formData.get("first_name") as string) || "",
    last_name: (formData.get("last_name") as string) || "",
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || "",
    preferred_contact: (formData.get("preferred_contact") as string) || "",
    source: (formData.get("source") as string) || "",
    status: ((formData.get("status") as string) || existing.status) as MemberStatus,
    primary_cra_id: (formData.get("primary_cra_id") as string) || "",
    lifecycle_stage: (formData.get("lifecycle_stage") as string) || "",
    tags: (formData.get("tags") as string) || "",
  };

  const parsed = memberSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const update = {
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: nullable(parsed.data.email),
    phone: nullable(parsed.data.phone),
    preferred_contact: nullable(parsed.data.preferred_contact),
    source: nullable(parsed.data.source),
    status: parsed.data.status,
    primary_cra_id: nullable(parsed.data.primary_cra_id),
    lifecycle_stage: nullable(parsed.data.lifecycle_stage),
    tags: parsed.data.tags
      ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("members")
    .update(update)
    .eq("id", memberId);
  if (error) throw new Error(error.message);

  const action =
    existing.status !== parsed.data.status
      ? "member.status_changed"
      : "member.updated";

  await logActivity({
    opcoId: existing.opco_id,
    userId: session.userId,
    entityType: "member",
    entityId: memberId,
    action,
    detail: { from: existing.status, to: parsed.data.status },
  });

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
}

export async function upsertProperty(
  memberId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, opco_id, primary_cra_id, created_by")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) throw new Error("Member not found");

  if (
    !canEditMember(
      session.roles,
      {
        primary_cra_id: member.primary_cra_id,
        created_by: member.created_by,
      },
      session.userId,
    )
  ) {
    throw new Error("You don't have permission to edit this member's properties.");
  }

  const id = (formData.get("property_id") as string) || null;
  const payload = {
    street: (formData.get("street") as string) || "",
    city: (formData.get("city") as string) || "",
    state: (formData.get("state") as string) || "",
    zip: (formData.get("zip") as string) || "",
    roof_material: (formData.get("roof_material") as string) || "",
    roof_age_years: (formData.get("roof_age_years") as string) || undefined,
    square_footage: (formData.get("square_footage") as string) || undefined,
    stories: (formData.get("stories") as string) || undefined,
    has_solar: formData.get("has_solar") === "on",
    has_skylights: formData.get("has_skylights") === "on",
    has_chimney: formData.get("has_chimney") === "on",
  };
  const parsed = propertySchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid property data");
  }

  const is_primary = formData.get("is_primary") === "on";

  const row = {
    opco_id: member.opco_id,
    member_id: memberId,
    is_primary,
    street: parsed.data.street,
    city: nullable(parsed.data.city),
    state: nullable(parsed.data.state),
    zip: nullable(parsed.data.zip),
    roof_material: nullable(parsed.data.roof_material),
    roof_age_years: parsed.data.roof_age_years ?? null,
    square_footage: parsed.data.square_footage ?? null,
    stories: parsed.data.stories ?? null,
    has_solar: parsed.data.has_solar ?? false,
    has_skylights: parsed.data.has_skylights ?? false,
    has_chimney: parsed.data.has_chimney ?? false,
    updated_at: new Date().toISOString(),
  };

  let propertyId = id;
  if (id) {
    const { error } = await supabase
      .from("properties")
      .update(row)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("properties")
      .insert(row)
      .select("id")
      .single();
    if (error || !inserted) {
      throw new Error(error?.message ?? "Failed to add property");
    }
    propertyId = inserted.id;
  }

  await logActivity({
    opcoId: member.opco_id,
    userId: session.userId,
    entityType: "property",
    entityId: propertyId ?? memberId,
    action: id ? "property.updated" : "property.created",
    detail: { street: parsed.data.street, member_id: memberId },
  });

  revalidatePath(`/members/${memberId}`);
}

export async function setMemberStatus(
  memberId: string,
  status: MemberStatus,
): Promise<void> {
  const session = await requireSession();
  if (!canManageMembers(session.roles)) {
    throw new Error("Forbidden");
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("members")
    .select("opco_id, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!existing) throw new Error("Member not found");

  const { error } = await supabase
    .from("members")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: existing.opco_id,
    userId: session.userId,
    entityType: "member",
    entityId: memberId,
    action: "member.status_changed",
    detail: { from: existing.status, to: status },
  });

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
}
