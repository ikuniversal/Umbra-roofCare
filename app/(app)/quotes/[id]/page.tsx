import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canAcceptQuote, canEditQuote } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Member,
  Opportunity,
  Profile,
  Quote,
  QuoteLineItem,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { QuoteBuilder } from "./quote-builder";
import { QuoteActions } from "./quote-actions";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle<Quote>();
  if (!quote) notFound();

  const [lineRes, oppRes, preparedRes] = await Promise.all([
    supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("opportunities")
      .select("id, member_id, type")
      .eq("id", quote.opportunity_id)
      .maybeSingle<Pick<Opportunity, "id" | "member_id" | "type">>(),
    quote.prepared_by
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", quote.prepared_by)
          .maybeSingle<Pick<Profile, "id" | "full_name" | "email">>()
      : Promise.resolve({ data: null }),
  ]);

  const lineItems = (lineRes.data ?? []) as QuoteLineItem[];
  const opportunity = oppRes.data as Pick<
    Opportunity,
    "id" | "member_id" | "type"
  > | null;
  const prepared = preparedRes.data as Pick<
    Profile,
    "id" | "full_name" | "email"
  > | null;

  let member: Member | null = null;
  if (opportunity?.member_id) {
    const { data } = await supabase
      .from("members")
      .select("*")
      .eq("id", opportunity.member_id)
      .maybeSingle<Member>();
    member = (data ?? null) as Member | null;
  }

  const editable = canEditQuote(
    session.roles,
    { prepared_by: quote.prepared_by },
    session.userId,
  );
  const canAccept = canAcceptQuote(session.roles);
  const locked = quote.status === "accepted" || quote.status === "rejected";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title={quote.quote_number}
        description={
          member
            ? `Quote for ${member.first_name} ${member.last_name}`
            : "Quote"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={QUOTE_STATUS_VARIANTS[quote.status]}>
              {QUOTE_STATUS_LABELS[quote.status]}
            </Badge>
            {opportunity ? (
              <Button asChild variant="outline">
                <Link href={`/opportunities/${opportunity.id}`}>
                  Opportunity
                </Link>
              </Button>
            ) : null}
            <QuoteActions
              quote={quote}
              editable={editable && !locked}
              canAccept={canAccept}
            />
          </div>
        }
      />

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
        <QuoteBuilder
          quote={quote}
          lineItems={lineItems}
          editable={editable && !locked}
        />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <p className="label-mono">Summary</p>
              <CardTitle>
                ${Math.round(quote.total).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SummaryRow label="Materials" value={quote.subtotal_materials} />
              <SummaryRow label="Labor" value={quote.subtotal_labor} />
              <SummaryRow label="Discount" value={quote.discount_amount} />
              <SummaryRow
                label={`Tax (${(quote.tax_rate * 100).toFixed(2)}%)`}
                value={quote.tax_amount}
              />
              <hr className="border-brand-border" />
              <SummaryRow label="Total" value={quote.total} bold />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <p className="label-mono">Details</p>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Prepared by" value={prepared?.full_name ?? prepared?.email ?? "—"} />
              <Row label="Valid until" value={formatDate(quote.valid_until)} />
              <Row label="Created" value={formatDate(quote.created_at)} />
              {quote.accepted_at ? (
                <Row label="Accepted" value={formatDate(quote.accepted_at)} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <p className="label-mono">{label}</p>
      <p className="text-brand-primary">{value ?? "—"}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number | null;
  bold?: boolean;
}) {
  const formatted = value === null ? "—" : `$${Math.round(value).toLocaleString()}`;
  return (
    <div className="flex items-center justify-between">
      <p className="label-mono">{label}</p>
      <p
        className={
          bold
            ? "metric-figure text-xl text-brand-primary"
            : "text-brand-primary"
        }
      >
        {formatted}
      </p>
    </div>
  );
}
