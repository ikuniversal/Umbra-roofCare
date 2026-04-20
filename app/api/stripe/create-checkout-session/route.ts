import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { canEnrollMember } from "@/lib/rbac";
import { createCheckoutSession } from "@/lib/stripe/subscriptions";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const bodySchema = z.object({
  member_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  frequency: z.enum(["annual", "monthly", "quarterly"]),
});

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
  if (!canEnrollMember(session.roles)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const result = await createCheckoutSession({
      memberId: parsed.data.member_id,
      planId: parsed.data.plan_id,
      frequency: parsed.data.frequency,
      successUrl: `${appUrl}/members/${parsed.data.member_id}?enrolled=1`,
      cancelUrl: `${appUrl}/members/${parsed.data.member_id}?enrollment_cancelled=1`,
      enrolledBy: session.userId,
    });

    await logActivity({
      opcoId: session.opcoId,
      userId: session.userId,
      entityType: "member",
      entityId: parsed.data.member_id,
      action: "subscription.enrollment_initiated",
      detail: {
        plan_id: parsed.data.plan_id,
        frequency: parsed.data.frequency,
        session_id: result.sessionId,
      },
    });

    return NextResponse.json({ url: result.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
