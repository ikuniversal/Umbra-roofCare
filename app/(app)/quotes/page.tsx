import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewOpportunities } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Member, Opportunity, Profile, Quote, QuoteStatus } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const STATUSES: (QuoteStatus | "all")[] = [
  "all",
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: QuoteStatus | "all" }>;
}) {
  const session = await requireSession();
  if (!canViewOpportunities(session.roles)) redirect("/dashboard");
  const params = await searchParams;
  const status = params.status ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const [{ data: quotesData }, { data: oppsData }, { data: membersData }, { data: profilesData }] =
    await Promise.all([
      query,
      supabase.from("opportunities").select("id, member_id, type"),
      supabase.from("members").select("id, first_name, last_name"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const quotes = (quotesData ?? []) as Quote[];
  const opps = (oppsData ?? []) as Pick<Opportunity, "id" | "member_id" | "type">[];
  const oppMap = new Map(opps.map((o) => [o.id, o]));
  const members = (membersData ?? []) as Pick<Member, "id" | "first_name" | "last_name">[];
  const memberMap = new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`]));
  const profiles = (profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[];
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? p.email ?? "—"]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title="Quotes"
        description="Every quote across the pipeline. Drill in to edit line items or accept."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/quotes${s === "all" ? "" : `?status=${s}`}`}
            prefetch={false}
          >
            <Badge variant={status === s ? "primary" : "outline"}>
              {s === "all"
                ? "All"
                : QUOTE_STATUS_LABELS[s as QuoteStatus]}
            </Badge>
          </Link>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-brand-muted">
              No quotes match the filter.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bg/50">
                  <tr>
                    <th className="label-mono px-4 py-3">Number</th>
                    <th className="label-mono px-4 py-3">Member</th>
                    <th className="label-mono px-4 py-3">Prepared by</th>
                    <th className="label-mono px-4 py-3">Status</th>
                    <th className="label-mono px-4 py-3">Total</th>
                    <th className="label-mono px-4 py-3">Valid until</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const opp = oppMap.get(q.opportunity_id);
                    const memberName = opp?.member_id
                      ? memberMap.get(opp.member_id)
                      : null;
                    return (
                      <tr
                        key={q.id}
                        className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="font-serif text-base text-brand-primary hover:underline"
                          >
                            {q.quote_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-brand-muted">
                          {memberName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-brand-muted">
                          {q.prepared_by
                            ? (profileMap.get(q.prepared_by) ?? "—")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={QUOTE_STATUS_VARIANTS[q.status]}>
                            {QUOTE_STATUS_LABELS[q.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 metric-figure text-brand-primary">
                          ${Math.round(q.total).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-brand-muted">
                          {formatDate(q.valid_until)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
