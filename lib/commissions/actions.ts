"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canApproveCommissions,
  canInitiatePayroll,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

const approveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function approveCommissions(
  input: z.infer<typeof approveSchema>,
): Promise<number> {
  const session = await requireSession();
  if (!canApproveCommissions(session.roles)) {
    throw new Error("Not authorized");
  }
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from("commissions")
    .update({
      status: "approved",
      approved_at: now,
      approved_by: session.userId,
    }, { count: "exact" })
    .in("id", parsed.data.ids)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  for (const id of parsed.data.ids) {
    await logActivity({
      opcoId: session.opcoId,
      userId: session.userId,
      entityType: "commission",
      entityId: id,
      action: "commission.approved",
    });
  }

  revalidatePath("/commissions");
  revalidatePath("/commissions/review");
  return count ?? 0;
}

const markPaidSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  paid_reference: z.string().max(80).optional(),
});

export async function markCommissionsPaid(
  input: z.infer<typeof markPaidSchema>,
): Promise<number> {
  const session = await requireSession();
  if (!canInitiatePayroll(session.roles)) {
    throw new Error("Not authorized");
  }
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from("commissions")
    .update({
      status: "paid",
      paid_at: now,
      paid_reference: parsed.data.paid_reference ?? null,
    }, { count: "exact" })
    .in("id", parsed.data.ids)
    .eq("status", "approved");
  if (error) throw new Error(error.message);

  for (const id of parsed.data.ids) {
    await logActivity({
      opcoId: session.opcoId,
      userId: session.userId,
      entityType: "commission",
      entityId: id,
      action: "commission.paid",
      detail: { paid_reference: parsed.data.paid_reference ?? null },
    });
  }

  revalidatePath("/commissions");
  revalidatePath("/commissions/review");
  revalidatePath("/commissions/payroll");
  return count ?? 0;
}

const runOverridesSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export async function runSalesManagerOverrides(
  input: z.infer<typeof runOverridesSchema>,
): Promise<number> {
  const session = await requireSession();
  if (!canInitiatePayroll(session.roles)) {
    throw new Error("Not authorized");
  }
  const parsed = runOverridesSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "compute_sales_manager_overrides",
    { p_year: parsed.data.year, p_month: parsed.data.month },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/commissions");
  return (data as number) ?? 0;
}
