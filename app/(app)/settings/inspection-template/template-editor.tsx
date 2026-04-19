"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_TEMPLATE_NAME,
  totalWeight,
} from "@/lib/inspections/template";
import type { InspectionTemplate, TemplateCheckpoint } from "@/lib/types";

interface Props {
  opcoId: string | null;
  template: InspectionTemplate | null;
  initialCheckpoints: TemplateCheckpoint[];
}

export function TemplateEditor({ opcoId, template, initialCheckpoints }: Props) {
  const router = useRouter();
  const [checkpoints, setCheckpoints] = React.useState<TemplateCheckpoint[]>(
    () => [...initialCheckpoints].sort((a, b) => a.order - b.order),
  );
  const [name, setName] = React.useState(template?.name ?? DEFAULT_TEMPLATE_NAME);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const totalWt = totalWeight(checkpoints);

  const updateField = <K extends keyof TemplateCheckpoint>(
    idx: number,
    field: K,
    value: TemplateCheckpoint[K],
  ) => {
    setCheckpoints((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  };

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= checkpoints.length) return;
    setCheckpoints((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, item);
      return copy.map((c, i) => ({ ...c, order: i + 1 }));
    });
  };

  const remove = (idx: number) => {
    setCheckpoints((prev) =>
      prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i + 1 })),
    );
  };

  const addRow = () => {
    const newId = `custom_${Math.random().toString(36).slice(2, 8)}`;
    setCheckpoints((prev) => [
      ...prev,
      {
        id: newId,
        label: "New checkpoint",
        category: "Custom",
        weight: 5,
        order: prev.length + 1,
      },
    ]);
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        opco_id: opcoId,
        name,
        checkpoints,
        active: true,
        updated_at: new Date().toISOString(),
      };

      if (template && template.opco_id === opcoId && opcoId !== null) {
        const { error: updErr } = await supabase
          .from("inspection_templates")
          .update({
            ...payload,
            version: template.version + 1,
          })
          .eq("id", template.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("inspection_templates")
          .insert({
            ...payload,
            version: 1,
          });
        if (insErr) throw insErr;
      }
      setStatus("Saved");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save template changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex items-end justify-end">
          <div className="rounded-md border border-brand-border bg-brand-bg px-4 py-2 text-right">
            <p className="label-mono">Total weight</p>
            <p
              className={
                totalWt === 100
                  ? "metric-figure text-2xl text-brand-success"
                  : "metric-figure text-2xl text-brand-warn"
              }
            >
              {totalWt}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-brand-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-bg/60">
            <tr>
              <th className="label-mono px-3 py-3">#</th>
              <th className="label-mono px-3 py-3">Label</th>
              <th className="label-mono px-3 py-3">Category</th>
              <th className="label-mono px-3 py-3">Weight</th>
              <th className="label-mono px-3 py-3 text-right">Move</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((cp, i) => (
              <tr
                key={cp.id}
                className="border-t border-brand-border"
              >
                <td className="px-3 py-2 font-mono text-xs text-brand-muted">
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={cp.label}
                    onChange={(e) => updateField(i, "label", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={cp.category}
                    onChange={(e) =>
                      updateField(i, "category", e.target.value)
                    }
                  />
                </td>
                <td className="px-3 py-2 w-24">
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={cp.weight}
                    onChange={(e) =>
                      updateField(i, "weight", Number(e.target.value))
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      className="rounded border border-brand-border p-1 text-brand-muted hover:bg-brand-bg"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      className="rounded border border-brand-border p-1 text-brand-muted hover:bg-brand-bg"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded p-1 text-brand-muted hover:text-brand-error"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={addRow} size="sm">
          <Plus className="h-4 w-4" />
          Add checkpoint
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : template?.opco_id === opcoId && opcoId ? "Save version" : "Save OpCo template"}
        </Button>
        {status ? (
          <span className="text-xs text-brand-success">{status}</span>
        ) : null}
        {error ? (
          <span className="text-xs text-brand-error">{error}</span>
        ) : null}
      </div>
      <p className="text-xs text-brand-faint">
        Saving creates or bumps the OpCo&apos;s own template. Inspections
        reference the template version they were captured against, so existing
        inspections keep their original scoring.
      </p>
    </div>
  );
}
