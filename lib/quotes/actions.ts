"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canAcceptQuote,
  canCreateQuote,
  canDeleteQuote,
  canEditQuote,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Quote, QuoteLineKind } from "@/lib/types";

const lineKinds: QuoteLineKind[] = ["material", "labor", "fee", "discount"];

const createSchema = z.object({
  opportunity_id: z.string().uuid(),
  valid_until: z.string().optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
});

export async function createQuote(
  input: z.infer<typeof createSchema>,
): Promise<string> {
  const session = await requireSession();
  if (!canCreateQuote(session.roles)) {
    throw new Error("Not authorized to create quotes");
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, opco_id")
    .eq("id", parsed.data.opportunity_id)
    .maybeSingle<{ id: string; opco_id: string }>();

  if (!opp) throw new Error("Opportunity not found");

  const { data: quoteNumber, error: rpcErr } = await supabase.rpc(
    "generate_quote_number",
    { p_opco_id: opp.opco_id },
  );
  if (rpcErr || !quoteNumber) {
    throw new Error(rpcErr?.message ?? "Could not generate quote number");
  }

  const { data: inserted, error } = await supabase
    .from("quotes")
    .insert({
      opco_id: opp.opco_id,
      opportunity_id: opp.id,
      quote_number: quoteNumber as string,
      status: "draft",
      prepared_by: session.userId,
      valid_until: parsed.data.valid_until || null,
      notes: parsed.data.notes || null,
      terms: parsed.data.terms || null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Failed to create quote");
  }

  // Mark opportunity as entering quoted stage if not beyond.
  await supabase
    .from("opportunities")
    .update({ stage: "quoted", quoted_at: new Date().toISOString() })
    .eq("id", opp.id)
    .in("stage", ["prospecting"]);

  await logActivity({
    opcoId: opp.opco_id,
    userId: session.userId,
    entityType: "quote",
    entityId: inserted.id,
    action: "quote.created",
    detail: { opportunity_id: opp.id, quote_number: quoteNumber },
  });

  revalidatePath(`/opportunities/${opp.id}`);
  revalidatePath("/quotes");
  return inserted.id;
}

const updateQuoteSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
  terms: z.string().max(2000).nullable().optional(),
  valid_until: z.string().nullable().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
  discount_amount: z.number().min(0).optional(),
});

export async function updateQuote(input: z.infer<typeof updateQuoteSchema>) {
  const session = await requireSession();
  const parsed = updateQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, prepared_by, opco_id, opportunity_id, status")
    .eq("id", parsed.data.id)
    .maybeSingle<Pick<
      Quote,
      "id" | "prepared_by" | "opco_id" | "opportunity_id" | "status"
    >>();
  if (!quote) throw new Error("Quote not found");
  if (!canEditQuote(session.roles, quote, session.userId)) {
    throw new Error("Not authorized to edit this quote");
  }
  if (quote.status === "accepted") {
    throw new Error("Accepted quotes cannot be edited. Create a revision.");
  }

  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from("quotes").update(rest).eq("id", id);
  if (error) throw new Error(error.message);

  // Trigger totals refresh in case tax_rate/discount_amount changed.
  await supabase.rpc("recalculate_quote_totals", { p_quote_id: id });

  revalidatePath(`/quotes/${id}`);
  revalidatePath(`/opportunities/${quote.opportunity_id}`);
}

const lineSchema = z.object({
  id: z.string().uuid().optional(),
  quote_id: z.string().uuid(),
  kind: z.enum(lineKinds as [QuoteLineKind, ...QuoteLineKind[]]),
  description: z.string().min(1).max(200),
  quantity: z.number().nonnegative(),
  unit: z.string().max(24).nullable().optional(),
  unit_price: z.number().nonnegative(),
  sort_order: z.number().int().optional(),
});

export async function upsertLineItem(input: z.infer<typeof lineSchema>) {
  const session = await requireSession();
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid line");
  }
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, prepared_by, opco_id, status")
    .eq("id", parsed.data.quote_id)
    .maybeSingle<Pick<Quote, "id" | "prepared_by" | "opco_id" | "status">>();
  if (!quote) throw new Error("Quote not found");
  if (!canEditQuote(session.roles, quote, session.userId)) {
    throw new Error("Not authorized");
  }
  if (quote.status === "accepted") {
    throw new Error("Accepted quotes are locked");
  }

  const row = {
    quote_id: parsed.data.quote_id,
    kind: parsed.data.kind,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit ?? null,
    unit_price: parsed.data.unit_price,
    line_total:
      Math.round(parsed.data.quantity * parsed.data.unit_price * 100) / 100,
    sort_order: parsed.data.sort_order ?? 0,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("quote_line_items")
      .update(row)
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("quote_line_items").insert(row);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/quotes/${parsed.data.quote_id}`);
}

export async function deleteLineItem(input: {
  quoteId: string;
  id: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, prepared_by, opco_id, status")
    .eq("id", input.quoteId)
    .maybeSingle<Pick<Quote, "id" | "prepared_by" | "opco_id" | "status">>();
  if (!quote) throw new Error("Quote not found");
  if (!canEditQuote(session.roles, quote, session.userId)) {
    throw new Error("Not authorized");
  }
  if (quote.status === "accepted") {
    throw new Error("Accepted quotes are locked");
  }
  const { error } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/quotes/${input.quoteId}`);
}

export async function sendQuote(quoteId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, prepared_by, opco_id, status, opportunity_id")
    .eq("id", quoteId)
    .maybeSingle<Pick<
      Quote,
      "id" | "prepared_by" | "opco_id" | "status" | "opportunity_id"
    >>();
  if (!quote) throw new Error("Quote not found");
  if (!canEditQuote(session.roles, quote, session.userId)) {
    throw new Error("Not authorized");
  }
  if (quote.status === "accepted") {
    throw new Error("Already accepted");
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent" })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: quote.opco_id,
    userId: session.userId,
    entityType: "quote",
    entityId: quoteId,
    action: "quote.sent",
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/opportunities/${quote.opportunity_id}`);
}

export async function acceptQuote(quoteId: string): Promise<string> {
  const session = await requireSession();
  if (!canAcceptQuote(session.roles)) {
    throw new Error("Not authorized to accept quotes");
  }
  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("accept_quote", {
    p_quote_id: quoteId,
  });
  if (error || !jobId) {
    throw new Error(error?.message ?? "Accept failed");
  }
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  revalidatePath("/jobs");
  revalidatePath("/opportunities");
  return jobId as string;
}

export async function rejectQuote(quoteId: string, reason?: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, prepared_by, opco_id, status, opportunity_id")
    .eq("id", quoteId)
    .maybeSingle<Pick<
      Quote,
      "id" | "prepared_by" | "opco_id" | "status" | "opportunity_id"
    >>();
  if (!quote) throw new Error("Quote not found");
  if (!canEditQuote(session.roles, quote, session.userId)) {
    throw new Error("Not authorized");
  }
  const { error } = await supabase
    .from("quotes")
    .update({ status: "rejected" })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);

  await logActivity({
    opcoId: quote.opco_id,
    userId: session.userId,
    entityType: "quote",
    entityId: quoteId,
    action: "quote.rejected",
    detail: reason ? { reason } : undefined,
  });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/opportunities/${quote.opportunity_id}`);
}

export async function deleteQuote(quoteId: string) {
  const session = await requireSession();
  if (!canDeleteQuote(session.roles)) {
    throw new Error("Not authorized");
  }
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, opportunity_id, status")
    .eq("id", quoteId)
    .maybeSingle<Pick<Quote, "id" | "opportunity_id" | "status">>();
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "accepted") {
    throw new Error("Cannot delete an accepted quote");
  }
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw new Error(error.message);
  revalidatePath("/quotes");
  revalidatePath(`/opportunities/${quote.opportunity_id}`);
}
