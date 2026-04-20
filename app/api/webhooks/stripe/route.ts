import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeIsConfigured } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleStripeEvent } from "@/lib/stripe/webhooks";

// IMPORTANT: Stripe requires the **raw** request body for signature
// verification. Next.js App Router's Request.text() returns the raw
// string, which is exactly what stripe.webhooks.constructEvent expects.
// Do NOT parse as JSON first.
//
// Idempotency is enforced at the DB level: subscription_events has a
// unique index on stripe_event_id. Duplicate deliveries hit the 23505
// constraint and we short-circuit.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!stripeIsConfigured()) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const payload = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Try to link the event to an existing subscription row, if any.
  let subscriptionRowId: string | null = null;
  const maybeSubId =
    (event.data.object as { id?: string; subscription?: string | { id: string } })
      .subscription;
  const stripeSubId =
    typeof maybeSubId === "string"
      ? maybeSubId
      : maybeSubId && typeof maybeSubId === "object"
        ? maybeSubId.id
        : undefined;

  if (stripeSubId) {
    const { data: row } = await admin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", stripeSubId)
      .maybeSingle<{ id: string }>();
    subscriptionRowId = row?.id ?? null;
  }

  // Insert the raw event (idempotent on stripe_event_id).
  const { error: insertErr } = await admin
    .from("subscription_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      subscription_id: subscriptionRowId,
    });

  if (insertErr) {
    // 23505 = duplicate, treat as already-handled.
    const code = (insertErr as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[stripe-webhook] insert failed", insertErr);
    // Fall through and still try to handle — Stripe will retry anyway.
  }

  try {
    await handleStripeEvent(event);
    await admin
      .from("subscription_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
  } catch (handlerErr) {
    const message =
      handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
    console.error("[stripe-webhook] handler error", event.type, message);
    await admin
      .from("subscription_events")
      .update({ error: message })
      .eq("stripe_event_id", event.id);
  }

  // Always 200 so Stripe doesn't retry forever — errors are captured on
  // the row and show up in /settings/stripe audit.
  return NextResponse.json({ ok: true });
}
