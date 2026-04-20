import { getStripe, stripeIsConfigured } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Job, Member, OpcoStripeAccount } from "@/lib/types";

export async function createJobInvoice(input: {
  jobId: string;
}): Promise<{ stripeInvoiceId: string }> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("*")
    .eq("id", input.jobId)
    .maybeSingle<Job>();
  if (!job) throw new Error("Job not found");
  if (!job.opco_id) throw new Error("Job has no opco");

  const { data: opcoAccount } = await admin
    .from("opco_stripe_accounts")
    .select("*")
    .eq("opco_id", job.opco_id)
    .maybeSingle<OpcoStripeAccount>();
  if (!opcoAccount?.stripe_account_id) {
    throw new Error(
      "OpCo has no Stripe Connect account. Complete onboarding first.",
    );
  }
  if (!opcoAccount.charges_enabled) {
    throw new Error(
      "OpCo Stripe account is not enabled for charges yet.",
    );
  }

  const { data: member } = await admin
    .from("members")
    .select("*")
    .eq("id", job.member_id ?? "")
    .maybeSingle<Member & { stripe_customer_id: string | null }>();
  if (!member) throw new Error("Member not found");

  const amount = job.final_cents ?? job.quoted_cents ?? 0;
  if (amount <= 0) throw new Error("Job has no billable amount");

  // Create invoice on the Connect account directly.
  const invoice = await stripe.invoices.create(
    {
      customer: member.stripe_customer_id ?? undefined,
      collection_method: "send_invoice",
      days_until_due: 14,
      description: job.scope_summary ?? `Job ${job.job_number ?? ""}`.trim(),
      metadata: { job_id: job.id, opco_id: job.opco_id },
    },
    { stripeAccount: opcoAccount.stripe_account_id },
  );

  await stripe.invoiceItems.create(
    {
      customer: member.stripe_customer_id ?? undefined,
      amount,
      currency: "usd",
      description: job.job_number ?? "Job service",
      invoice: invoice.id,
    },
    { stripeAccount: opcoAccount.stripe_account_id },
  );

  await admin.from("invoices").insert({
    opco_id: job.opco_id,
    member_id: job.member_id,
    job_id: job.id,
    stripe_invoice_id: invoice.id,
    kind: "job_invoice",
    status: "draft",
    subtotal_cents: amount,
    total_cents: amount,
    amount_remaining_cents: amount,
    notes: job.scope_summary,
  });

  return { stripeInvoiceId: invoice.id ?? "" };
}

export async function sendInvoice(invoiceId: string): Promise<void> {
  if (!stripeIsConfigured()) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = getStripe();
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, opco_id, stripe_invoice_id")
    .eq("id", invoiceId)
    .maybeSingle<{
      id: string;
      opco_id: string;
      stripe_invoice_id: string | null;
    }>();
  if (!invoice?.stripe_invoice_id) throw new Error("Invoice has no Stripe ID");

  const { data: opcoAccount } = await admin
    .from("opco_stripe_accounts")
    .select("stripe_account_id")
    .eq("opco_id", invoice.opco_id)
    .maybeSingle<{ stripe_account_id: string | null }>();

  const stripeAccount = opcoAccount?.stripe_account_id ?? undefined;

  await stripe.invoices.finalizeInvoice(invoice.stripe_invoice_id, undefined, {
    stripeAccount,
  });
  await stripe.invoices.sendInvoice(invoice.stripe_invoice_id, undefined, {
    stripeAccount,
  });

  await admin
    .from("invoices")
    .update({ status: "open", issued_at: new Date().toISOString() })
    .eq("id", invoice.id);
}
