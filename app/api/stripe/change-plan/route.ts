import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { canChangeSubscriptionPlan } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { upgradeSubscription } from "@/lib/stripe/subscriptions";
import { logActivity } from "@/lib/activity";
import type { Subscription } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  subscription_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  frequency: z.enum(["annual", "monthly", "quarterly"]),
});

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, opco_id, member_id, plan_id, enrolled_by, frequency")
    .eq("id", parsed.data.subscription_id)
    .maybeSingle<Pick<
      Subscription,
      "id" | "opco_id" | "member_id" | "plan_id" | "enrolled_by" | "frequency"
    >>();
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  if (!canChangeSubscriptionPlan(session.roles, sub, session.userId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    await upgradeSubscription({
      subscriptionId: sub.id,
      newPlanId: parsed.data.plan_id,
      newFrequency: parsed.data.frequency,
    });
    await logActivity({
      opcoId: sub.opco_id,
      userId: session.userId,
      entityType: "subscription",
      entityId: sub.id,
      action: "subscription.plan_changed",
      detail: {
        from_plan: sub.plan_id,
        to_plan: parsed.data.plan_id,
        from_frequency: sub.frequency,
        to_frequency: parsed.data.frequency,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Change failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
