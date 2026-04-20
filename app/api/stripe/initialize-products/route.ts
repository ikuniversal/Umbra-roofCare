import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { canManageStripeSettings } from "@/lib/rbac";
import { ensureProductsExist } from "@/lib/stripe/products";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const session = await requireSession();
  if (!canManageStripeSettings(session.roles)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const result = await ensureProductsExist();
    await logActivity({
      opcoId: null,
      userId: session.userId,
      entityType: "stripe",
      entityId: "platform",
      action: "stripe.products_initialized",
      detail: {
        created: result.plans.map((p) => p.code),
        skipped: result.skipped,
      },
    });
    return NextResponse.json({
      ok: true,
      created: result.plans.map((p) => p.code),
      skipped: result.skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Init failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
