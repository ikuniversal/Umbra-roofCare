"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/money";
import {
  markCommissionsPaid,
  runSalesManagerOverrides,
} from "@/lib/commissions/actions";
import {
  COMMISSION_KIND_LABELS,
} from "@/lib/labels";
import type { Commission } from "@/lib/types";

export function PayrollBatch({
  commissions,
  profileMap,
  defaultOverrideYear,
  defaultOverrideMonth,
}: {
  commissions: Commission[];
  profileMap: Record<string, string>;
  defaultOverrideYear: number;
  defaultOverrideMonth: number;
}) {
  const router = useRouter();
  const [reference, setReference] = React.useState(
    `PAYROLL-${new Date().toISOString().slice(0, 7)}`,
  );
  const [year, setYear] = React.useState(String(defaultOverrideYear));
  const [month, setMonth] = React.useState(String(defaultOverrideMonth));
  const [pending, setPending] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const total = commissions.reduce((sum, c) => sum + c.amount_cents, 0);

  const runOverrides = async () => {
    setPending("overrides");
    setError(null);
    setStatus(null);
    try {
      const count = await runSalesManagerOverrides({
        year: Number(year),
        month: Number(month),
      });
      setStatus(
        count > 0
          ? `Created ${count} sales manager override${count === 1 ? "" : "s"} for ${year}-${month.padStart(2, "0")}.`
          : `Overrides already recorded for ${year}-${month.padStart(2, "0")}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setPending(null);
    }
  };

  const markAllPaid = async () => {
    if (commissions.length === 0) return;
    if (
      !confirm(
        `Mark ${commissions.length} commissions paid with reference "${reference}"?`,
      )
    ) {
      return;
    }
    setPending("pay");
    setError(null);
    setStatus(null);
    try {
      const count = await markCommissionsPaid({
        ids: commissions.map((c) => c.id),
        paid_reference: reference,
      });
      setStatus(`Marked ${count} commissions paid.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payroll failed");
    } finally {
      setPending(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["reference", "earner", "kind", "basis", "rate", "amount_cents", "period"].join(","),
      ...commissions.map((c) =>
        [
          reference,
          `"${profileMap[c.profile_id] ?? c.profile_id}"`,
          c.kind,
          c.basis_cents,
          c.rate ?? "",
          c.amount_cents,
          c.period_year && c.period_month
            ? `${c.period_year}-${String(c.period_month).padStart(2, "0")}`
            : "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reference}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="label-mono">Monthly sales manager overrides</h3>
        <div className="grid gap-3 md:grid-cols-[120px_120px_auto]">
          <div className="space-y-2">
            <Label>Year</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Month</Label>
            <Input value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              onClick={runOverrides}
              disabled={pending === "overrides"}
              variant="outline"
            >
              {pending === "overrides" ? "Running…" : "Compute overrides"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="label-mono">Approved batch</h3>
        {commissions.length === 0 ? (
          <p className="text-sm text-brand-muted">
            Nothing approved to pay. Use the approval queue first.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>Paid reference</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="PAYROLL-YYYY-MM"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={exportCsv}>
                  Export CSV
                </Button>
                <Button
                  onClick={markAllPaid}
                  disabled={pending === "pay"}
                  variant="accent"
                >
                  {pending === "pay"
                    ? "Marking…"
                    : `Mark ${commissions.length} paid`}
                </Button>
              </div>
            </div>
            <p className="text-sm text-brand-muted">
              Batch total: {formatCents(total)}
            </p>
            <ul className="divide-y divide-brand-border rounded-md border border-brand-border">
              {commissions.slice(0, 20).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="text-brand-primary">
                    {profileMap[c.profile_id] ?? c.profile_id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-brand-muted">
                    {COMMISSION_KIND_LABELS[c.kind]}
                  </span>
                  <span className="metric-figure text-brand-primary">
                    {formatCents(c.amount_cents)}
                  </span>
                </li>
              ))}
              {commissions.length > 20 ? (
                <li className="px-3 py-2 text-xs text-brand-muted">
                  + {commissions.length - 20} more in the CSV export
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </section>

      {status ? (
        <p className="rounded-md border border-brand-success/30 bg-brand-success/5 px-3 py-2 text-xs text-brand-success">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-brand-error/30 bg-brand-error/5 px-3 py-2 text-xs text-brand-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
