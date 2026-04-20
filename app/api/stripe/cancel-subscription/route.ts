import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { canCancelSubscription } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { cancelSubscription } from "@/lib/stripe/subscriptions";
import { logActivity } from "@/lib/activity";
import type { Subscription } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  subscription_id: z.string().uuid(),
  at_period_end: z.boolean(),
  reason: z.string().max(200).optional(),
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
    .select("id, opco_id, enrolled_by")
    .eq("id", parsed.data.subscription_id)
    .maybeSingle<Pick<Subscription, "id" | "opco_id" | "enrolled_by">>();
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  if (!canCancelSubscription(session.roles, sub, session.userId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    await cancelSubscription({
      subscriptionId: sub.id,
      atPeriodEnd: parsed.data.at_period_end,
      reason: parsed.data.reason,
    });
    await logActivity({
      opcoId: sub.opco_id,
      userId: session.userId,
      entityType: "subscription",
      entityId: sub.id,
      action: "subscription.canceled",
      detail: {
        at_period_end: parsed.data.at_period_end,
        reason: parsed.data.reason ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
