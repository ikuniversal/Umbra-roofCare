"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CommissionKindBadge,
} from "@/components/monetization/status-badges";
import { formatCents, formatPercentRate } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { approveCommissions } from "@/lib/commissions/actions";
import type { Commission } from "@/lib/types";

export function ApprovalQueue({
  commissions,
  profileMap,
}: {
  commissions: Commission[];
  profileMap: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedTotal = commissions
    .filter((c) => selected[c.id])
    .reduce((sum, c) => sum + c.amount_cents, 0);

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    for (const c of commissions) next[c.id] = on;
    setSelected(next);
  };

  const approve = async () => {
    if (selectedIds.length === 0) return;
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const count = await approveCommissions({ ids: selectedIds });
      setStatus(`Approved ${count} commission${count === 1 ? "" : "s"}.`);
      setSelected({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setPending(false);
    }
  };

  if (commissions.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-brand-muted">
        Nothing pending. The queue is clear.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Checkbox
            label={
              <span className="text-xs text-brand-muted">
                Select all ({commissions.length})
              </span>
            }
            checked={selectedIds.length === commissions.length}
            onChange={(e) =>
              toggleAll((e.target as HTMLInputElement).checked)
            }
          />
          {selectedIds.length > 0 ? (
            <span className="label-mono">
              {selectedIds.length} selected · {formatCents(selectedTotal)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {status ? (
            <span className="text-xs text-brand-success">{status}</span>
          ) : null}
          {error ? (
            <span className="text-xs text-brand-error">{error}</span>
          ) : null}
          <Button
            onClick={approve}
            disabled={pending || selectedIds.length === 0}
            variant="accent"
          >
            {pending ? "Approving…" : "Approve selected"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-bg/50">
            <tr>
              <th className="px-4 py-3" />
              <th className="label-mono px-4 py-3">Earned</th>
              <th className="label-mono px-4 py-3">Earner</th>
              <th className="label-mono px-4 py-3">Kind</th>
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
                <td className="px-4 py-3">
                  <Checkbox
                    checked={Boolean(selected[c.id])}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [c.id]: (e.target as HTMLInputElement).checked,
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {formatDate(c.earned_at)}
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {profileMap[c.profile_id] ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <CommissionKindBadge kind={c.kind} />
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
    </div>
  );
}
