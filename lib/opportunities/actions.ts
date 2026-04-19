"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { canEditOpportunity } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity, OpportunityStage } from "@/lib/types";

const stages: OpportunityStage[] = [
  "prospecting",
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "lost",
];

const updateStageSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(stages as [OpportunityStage, ...OpportunityStage[]]),
  order: z.number().int().optional(),
});

export async function updateOpportunityStage(input: {
  id: string;
  stage: OpportunityStage;
  order?: number;
}) {
  const session = await requireSession();
  const parsed = updateStageSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, stage, assigned_specialist_id, assigned_to, opco_id")
    .eq("id", parsed.data.id)
    .maybeSingle<Pick<
      Opportunity,
      "id" | "stage" | "assigned_specialist_id" | "assigned_to" | "opco_id"
    >>();
  if (!opp) throw new Error("Opportunity not found");
  if (
    !canEditOpportunity(
      session.roles,
      {
        assigned_specialist_id: opp.assigned_specialist_id,
        assigned_to: opp.assigned_to,
      },
      session.userId,
    )
  ) {
    throw new Error("Not authorized");
  }

  const fromStage = opp.stage;

  const { error } = await supabase
    .from("opportunities")
    .update({
      stage: parsed.data.stage,
      stage_order: parsed.data.order ?? 0,
    })
    .eq("id", parsed.data.id);

  if (error) throw new Error(error.message);

  if (fromStage !== parsed.data.stage) {
    await logActivity({
      opcoId: opp.opco_id,
      userId: session.userId,
      entityType: "opportunity",
      entityId: parsed.data.id,
      action: "opportunity.stage_changed",
      detail: { from_stage: fromStage, to_stage: parsed.data.stage },
    });
  }

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${parsed.data.id}`);
}

const updateOpportunitySchema = z.object({
  id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable().optional(),
  value_estimate: z.number().nonnegative().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  priority: z
    .enum(["low", "normal", "high", "urgent"])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
  lost_reason: z.string().max(500).nullable().optional(),
});

export async function updateOpportunity(
  input: z.infer<typeof updateOpportunitySchema>,
) {
  const session = await requireSession();
  const parsed = updateOpportunitySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, assigned_specialist_id, assigned_to, opco_id, value_estimate")
    .eq("id", parsed.data.id)
    .maybeSingle<
      Pick<
        Opportunity,
        | "id"
        | "assigned_specialist_id"
        | "assigned_to"
        | "opco_id"
        | "value_estimate"
      >
    >();
  if (!opp) throw new Error("Opportunity not found");
  if (
    !canEditOpportunity(
      session.roles,
      {
        assigned_specialist_id: opp.assigned_specialist_id,
        assigned_to: opp.assigned_to,
      },
      session.userId,
    )
  ) {
    throw new Error("Not authorized");
  }

  const { id, ...rest } = parsed.data;
  const { error } = await supabase
    .from("opportunities")
    .update(rest)
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (rest.assigned_to !== undefined) {
    await logActivity({
      opcoId: opp.opco_id,
      userId: session.userId,
      entityType: "opportunity",
      entityId: id,
      action: "opportunity.assigned",
      detail: { assigned_to: rest.assigned_to },
    });
  }
  if (rest.value_estimate !== undefined && rest.value_estimate !== opp.value_estimate) {
    await logActivity({
      opcoId: opp.opco_id,
      userId: session.userId,
      entityType: "opportunity",
      entityId: id,
      action: "opportunity.value_updated",
      detail: {
        old: opp.value_estimate,
        new: rest.value_estimate,
      },
    });
  }

  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
}
