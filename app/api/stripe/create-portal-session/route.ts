import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe/subscriptions";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

const bodySchema = z.object({ member_id: z.string().uuid() });

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
    return NextResponse.json({ error: "member_id required" }, { status: 400 });
  }

  void session; // authentication gate only

  const appUrl = getSiteUrl();
  try {
    const { url } = await createPortalSession({
      memberId: parsed.data.member_id,
      returnUrl: `${appUrl}/members/${parsed.data.member_id}`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
