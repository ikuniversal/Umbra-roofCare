import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { canManageOpcoStripeAccount } from "@/lib/rbac";
import {
  createOpcoConnectAccount,
  getOnboardingLink,
  syncOpcoAccountStatus,
} from "@/lib/stripe/connect";

export const runtime = "nodejs";

const bodySchema = z.object({
  opco_id: z.string().uuid(),
  action: z.enum(["create", "onboarding_link", "sync"]),
});

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession();
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
  if (
    !canManageOpcoStripeAccount(
      session.roles,
      parsed.data.opco_id,
      session.opcoId,
    )
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    if (parsed.data.action === "create") {
      const id = await createOpcoConnectAccount(parsed.data.opco_id);
      return NextResponse.json({ stripe_account_id: id });
    }
    if (parsed.data.action === "onboarding_link") {
      const url = await getOnboardingLink(parsed.data.opco_id);
      return NextResponse.json({ url });
    }
    if (parsed.data.action === "sync") {
      const status = await syncOpcoAccountStatus(parsed.data.opco_id);
      return NextResponse.json(status);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
