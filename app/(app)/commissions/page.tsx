import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  canApproveCommissions,
  canInitiatePayroll,
  canViewCommissions,
  hasRole,
  isPlatformAdmin,
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Commission, Profile } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CommissionKindBadge,
  CommissionStatusBadge,
} from "@/components/monetization/status-badges";
import { formatCents, formatPercentRate } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export default async function CommissionsPage() {
  const session = await requireSession();
  if (!canViewCommissions(session.roles)) redirect("/dashboard");
  const supabase = await createClient();

  const isManager =
    isPlatformAdmin(session.roles) ||
    hasRole(session.roles, ["opco_gm", "sales_manager", "area_manager"]);

  let query = supabase
    .from("commissions")
    .select("*")
    .order("earned_at", { ascending: false });
  if (!isManager) {
    // Everyone else sees only their own; RLS will enforce this anyway but
    // being explicit keeps the query fast.
    query = query.eq("profile_id", session.userId);
  }

  const [{ data: commissionsData }, { data: profilesData }] = await Promise.all(
    [
      query,
      supabase.from("profiles").select("id, full_name, email"),
    ],
  );
  const commissions = (commissionsData ?? []) as Commission[];
  const profileMap = Object.fromEntries(
    ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"],
    ),
  );

  const totalPending = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const totalApproved = commissions
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.amount_cents, 0);
  const totalPaidYtd = commissions
    .filter(
      (c) =>
        c.status === "paid" &&
        c.paid_at &&
        new Date(c.paid_at).getFullYear() === new Date().getFullYear(),
    )
    .reduce((sum, c) => sum + c.amount_cents, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Monetization · Phase 5"
        title="Commissions"
        description={
          isManager
            ? "Earnings across the OpCo — approve, pay, and monitor."
            : "Your earnings — enrollment commissions, renewals, and job splits."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canApproveCommissions(session.roles) ? (
              <Button asChild variant="outline">
                <Link href="/commissions/review">Approval queue</Link>
              </Button>
            ) : null}
            {canInitiatePayroll(session.roles) ? (
              <Button asChild variant="accent">
                <Link href="/commissions/payroll">Payroll</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <SummaryTile label="Pending" value={formatCents(totalPending)} />
        <SummaryTile label="Approved" value={formatCents(totalApproved)} />
        <SummaryTile label="Paid YTD" value={formatCents(totalPaidYtd)} />
      </section>

      <Card className="mt-6">
        <CardContent className="p-0">
          {commissions.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-brand-muted">
              No commissions yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bg/50">
                  <tr>
                    <th className="label-mono px-4 py-3">Earned</th>
                    {isManager ? (
                      <th className="label-mono px-4 py-3">Earner</th>
                    ) : null}
                    <th className="label-mono px-4 py-3">Kind</th>
                    <th className="label-mono px-4 py-3">Status</th>
                    <th className="label-mono px-4 py-3 text-right">Basis</th>
                    <th className="label-mono px-4 py-3 text-right">Rate</th>
                    <th className="label-mono px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
                    >
                      <td className="px-4 py-3 text-brand-muted">
                        {formatDate(c.earned_at)}
                      </td>
                      {isManager ? (
                        <td className="px-4 py-3 text-brand-muted">
                          {profileMap[c.profile_id] ?? "—"}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <CommissionKindBadge kind={c.kind} />
                      </td>
                      <td className="px-4 py-3">
                        <CommissionStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-brand-muted">
                        {formatCents(c.basis_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-brand-muted">
                        {formatPercentRate(c.rate)}
                      </td>
                      <td className="px-4 py-3 text-right metric-figure text-brand-primary">
                        {formatCents(c.amount_cents)}
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-brand-border bg-brand-card p-4">
      <p className="label-mono">{label}</p>
      <p className="metric-figure mt-1 text-2xl text-brand-primary">{value}</p>
    </div>
  );
}
