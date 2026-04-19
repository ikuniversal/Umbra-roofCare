"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUOTE_LINE_KIND_LABELS } from "@/lib/labels";
import type { Quote, QuoteLineItem, QuoteLineKind } from "@/lib/types";
import {
  deleteLineItem,
  updateQuote,
  upsertLineItem,
} from "@/lib/quotes/actions";

interface Props {
  quote: Quote;
  lineItems: QuoteLineItem[];
  editable: boolean;
}

type Draft = {
  id: string;
  kind: QuoteLineKind;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  sort_order: number;
  persistedId?: string;
  dirty: boolean;
};

const KIND_ORDER: QuoteLineKind[] = ["material", "labor", "fee", "discount"];

function newDraft(kind: QuoteLineKind, sort_order: number): Draft {
  return {
    id: `new-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    description: "",
    quantity: "1",
    unit: "",
    unit_price: "0",
    sort_order,
    dirty: true,
  };
}

function toDraft(item: QuoteLineItem): Draft {
  return {
    id: item.id,
    kind: item.kind,
    description: item.description,
    quantity: String(item.quantity),
    unit: item.unit ?? "",
    unit_price: String(item.unit_price),
    sort_order: item.sort_order,
    persistedId: item.id,
    dirty: false,
  };
}

export function QuoteBuilder({ quote, lineItems, editable }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(() =>
    lineItems.map(toDraft),
  );
  const [taxRate, setTaxRate] = React.useState(
    (quote.tax_rate * 100).toFixed(2),
  );
  const [discount, setDiscount] = React.useState(
    quote.discount_amount.toString(),
  );
  const [notes, setNotes] = React.useState(quote.notes ?? "");
  const [terms, setTerms] = React.useState(quote.terms ?? "");
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDrafts(lineItems.map(toDraft));
  }, [lineItems]);

  const addRow = (kind: QuoteLineKind) => {
    setDrafts((prev) => [...prev, newDraft(kind, prev.length)]);
  };

  const patch = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, dirty: true } : d)),
    );
  };

  const saveRow = async (draft: Draft) => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await upsertLineItem({
        id: draft.persistedId,
        quote_id: quote.id,
        kind: draft.kind,
        description: draft.description,
        quantity: Number(draft.quantity) || 0,
        unit: draft.unit || null,
        unit_price: Number(draft.unit_price) || 0,
        sort_order: draft.sort_order,
      });
      setStatus("Saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (draft: Draft) => {
    if (!draft.persistedId) {
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      return;
    }
    if (!confirm("Delete this line item?")) return;
    setSaving(true);
    try {
      await deleteLineItem({ quoteId: quote.id, id: draft.persistedId });
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const saveMeta = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateQuote({
        id: quote.id,
        tax_rate: Number(taxRate) / 100,
        discount_amount: Number(discount) || 0,
        notes: notes || null,
        terms: terms || null,
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
    <Card>
      <CardHeader>
        <p className="label-mono">Line items</p>
        <CardTitle>Quote builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {KIND_ORDER.map((kind) => {
          const inKind = drafts.filter((d) => d.kind === kind);
          return (
            <section key={kind}>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg text-brand-primary">
                  {QUOTE_LINE_KIND_LABELS[kind]}
                </h3>
                {editable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addRow(kind)}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                ) : null}
              </div>
              {inKind.length === 0 ? (
                <p className="mt-2 rounded border border-dashed border-brand-border px-3 py-3 text-xs text-brand-faint">
                  No {QUOTE_LINE_KIND_LABELS[kind].toLowerCase()} lines.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {inKind.map((d) => (
                    <LineItemRow
                      key={d.id}
                      draft={d}
                      editable={editable}
                      onPatch={(patch) => patch && patch}
                      onChange={(patchArg) => patch(d.id, patchArg)}
                      onSave={() => saveRow(d)}
                      onDelete={() => removeRow(d)}
                      saving={saving}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="grid gap-3 border-t border-brand-border pt-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tax_rate">Tax rate (%)</Label>
            <Input
              id="tax_rate"
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              disabled={!editable}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount">Quote-level discount ($)</Label>
            <Input
              id="discount"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={!editable}
            />
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="notes">Notes / cover</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!editable}
            className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
        </section>
        <section className="space-y-2">
          <Label htmlFor="terms">Terms</Label>
          <textarea
            id="terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            disabled={!editable}
            className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
        </section>

        {editable ? (
          <div className="flex items-center gap-3">
            <Button onClick={saveMeta} disabled={saving}>
              {saving ? "Saving…" : "Save quote"}
            </Button>
            {status ? (
              <span className="text-xs text-brand-success">{status}</span>
            ) : null}
            {error ? (
              <span className="text-xs text-brand-error">{error}</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LineItemRow({
  draft,
  editable,
  onChange,
  onSave,
  onDelete,
  saving,
}: {
  draft: Draft;
  editable: boolean;
  onPatch: (patch: Partial<Draft>) => Partial<Draft> | null;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const total = (Number(draft.quantity) || 0) * (Number(draft.unit_price) || 0);
  return (
    <div className="grid gap-2 rounded-md border border-brand-border bg-brand-bg/50 p-3 md:grid-cols-[1fr_80px_80px_100px_100px_auto]">
      <Input
        placeholder="Description"
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        disabled={!editable}
      />
      <Input
        inputMode="decimal"
        placeholder="Qty"
        value={draft.quantity}
        onChange={(e) => onChange({ quantity: e.target.value })}
        disabled={!editable}
      />
      <Select
        value={draft.kind}
        onValueChange={(v) => onChange({ kind: v as QuoteLineKind })}
        disabled={!editable}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KIND_ORDER.map((k) => (
            <SelectItem key={k} value={k}>
              {QUOTE_LINE_KIND_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        inputMode="decimal"
        placeholder="Unit $"
        value={draft.unit_price}
        onChange={(e) => onChange({ unit_price: e.target.value })}
        disabled={!editable}
      />
      <div className="flex items-center justify-end px-2 metric-figure text-sm text-brand-primary">
        ${total.toFixed(2)}
      </div>
      {editable ? (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={draft.dirty ? "accent" : "outline"}
            onClick={onSave}
            disabled={saving || !draft.description.trim()}
          >
            {draft.persistedId ? "Update" : "Save"}
          </Button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-brand-border p-2 text-brand-muted hover:text-brand-error"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
