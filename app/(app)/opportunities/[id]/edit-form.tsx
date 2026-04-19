"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Opportunity, OpportunityPriority, Profile } from "@/lib/types";
import { updateOpportunity } from "@/lib/opportunities/actions";

interface Props {
  opportunity: Opportunity;
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  canEdit: boolean;
}

export function OpportunityEditForm({ opportunity, profiles, canEdit }: Props) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    priority: opportunity.priority,
    assigned_to: opportunity.assigned_to ?? "",
    value_estimate: opportunity.value_estimate?.toString() ?? "",
    expected_close_date: opportunity.expected_close_date ?? "",
    notes: opportunity.notes ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateOpportunity({
        id: opportunity.id,
        priority: values.priority as OpportunityPriority,
        assigned_to: values.assigned_to || null,
        value_estimate: values.value_estimate
          ? Number(values.value_estimate)
          : null,
        expected_close_date: values.expected_close_date || null,
        notes: values.notes || null,
      });
      setStatus("Saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={values.priority}
            onValueChange={(v) =>
              setValues((prev) => ({
                ...prev,
                priority: v as OpportunityPriority,
              }))
            }
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Assigned to</Label>
          <Select
            value={values.assigned_to}
            onValueChange={(v) =>
              setValues((prev) => ({ ...prev, assigned_to: v }))
            }
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.email ?? "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="value_estimate">Value estimate ($)</Label>
          <Input
            id="value_estimate"
            inputMode="decimal"
            value={values.value_estimate}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                value_estimate: e.target.value,
              }))
            }
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expected_close_date">Expected close</Label>
          <Input
            id="expected_close_date"
            type="date"
            value={values.expected_close_date}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                expected_close_date: e.target.value,
              }))
            }
            disabled={!canEdit}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="opp-notes">Notes</Label>
        <textarea
          id="opp-notes"
          value={values.notes}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, notes: e.target.value }))
          }
          disabled={!canEdit}
          className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:opacity-60"
        />
      </div>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {status ? (
            <span className="text-xs text-brand-success">{status}</span>
          ) : null}
          {error ? (
            <span className="text-xs text-brand-error">{error}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
