import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewInvoices } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceKind, InvoiceStatus, Member } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { INVOICE_KIND_LABELS, INVOICE_STATUS_LABELS } from "@/lib/labels";
import {
  InvoiceKindBadge,
  InvoiceStatusBadge,
} from "@/components/monetization/status-badges";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/utils";

const STATUSES: (InvoiceStatus | "all")[] = [
  "all",
  "open",
  "paid",
  "uncollectible",
  "void",
];
const KINDS: (InvoiceKind | "all")[] = [
  "all",
  "subscription_initial",
  "subscription_renewal",
  "subscription_upgrade",
  "job_invoice",
  "manual",
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: InvoiceStatus | "all";
    kind?: InvoiceKind | "all";
  }>;
}) {
  const session = await requireSession();
  if (!canViewInvoices(session.roles)) redirect("/dashboard");
  const params = await searchParams;
  const supabase = await createClient();

  const status = params.status ?? "all";
  const kind = params.kind ?? "all";

  let query = supabase
    .from("invoices")
    .select("*")
    .order("issued_at", { ascending: false, nullsFirst: false });
  if (status !== "all") query = query.eq("status", status);
  if (kind !== "all") query = query.eq("kind", kind);

  const [{ data: invoicesData }, { data: membersData }] = await Promise.all([
    query,
    supabase.from("members").select("id, first_name, last_name"),
  ]);
  const invoices = (invoicesData ?? []) as Invoice[];
  const memberMap = Object.fromEntries(
    ((membersData ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).map(
      (m) => [m.id, `${m.first_name} ${m.last_name}`],
    ),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Monetization · Phase 5"
        title="Invoices"
        description="Subscription and job billing across every OpCo."
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono">Status</span>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildLink({ status: s, kind })}
              prefetch={false}
            >
              <Badge variant={status === s ? "primary" : "outline"}>
                {s === "all" ? "All" : INVOICE_STATUS_LABELS[s as InvoiceStatus]}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono">Kind</span>
          {KINDS.map((k) => (
            <Link
              key={k}
              href={buildLink({ status, kind: k })}
              prefetch={false}
            >
              <Badge variant={kind === k ? "primary" : "outline"}>
                {k === "all" ? "All" : INVOICE_KIND_LABELS[k as InvoiceKind]}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-brand-muted">
              No invoices match the current filters.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bg/50">
                  <tr>
                    <th className="label-mono px-4 py-3">Issued</th>
                    <th className="label-mono px-4 py-3">Member</th>
                    <th className="label-mono px-4 py-3">Kind</th>
                    <th className="label-mono px-4 py-3">Status</th>
                    <th className="label-mono px-4 py-3 text-right">Total</th>
                    <th className="label-mono px-4 py-3 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr
                      key={i.id}
                      className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
                    >
                      <td className="px-4 py-3 text-brand-muted">
                        {formatDate(i.issued_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/invoices/${i.id}`}
                          className="font-serif text-base text-brand-primary hover:underline"
                        >
                          {i.member_id
                            ? (memberMap[i.member_id] ?? "—")
                            : "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceKindBadge kind={i.kind} />
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={i.status} />
                      </td>
                      <td className="px-4 py-3 text-right metric-figure text-brand-primary">
                        {formatCents(i.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-brand-muted">
                        {formatCents(i.amount_paid_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildLink({
  status,
  kind,
}: {
  status: InvoiceStatus | "all";
  kind: InvoiceKind | "all";
}): string {
  const sp = new URLSearchParams();
  if (status !== "all") sp.set("status", status);
  if (kind !== "all") sp.set("kind", kind);
  const qs = sp.toString();
  return qs ? `/invoices?${qs}` : "/invoices";
}
