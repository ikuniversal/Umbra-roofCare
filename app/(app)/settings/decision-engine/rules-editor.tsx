"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { DecisionRule } from "@/lib/types";

interface Props {
  opcoId: string | null;
  rules: DecisionRule[];
}

type Draft = DecisionRule & {
  conditionsText: string;
  actionsText: string;
  isNew?: boolean;
};

function toDraft(rule: DecisionRule): Draft {
  return {
    ...rule,
    conditionsText: JSON.stringify(rule.conditions, null, 2),
    actionsText: JSON.stringify(rule.actions, null, 2),
  };
}

export function RulesEditor({ opcoId, rules }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(() => rules.map(toDraft));
  const [saving, setSaving] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<Record<string, string>>({});

  const supabase = createClient();

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
  };

  const setError = (id: string, msg: string | null) => {
    setErrors((prev) => {
      const copy = { ...prev };
      if (msg === null) delete copy[id];
      else copy[id] = msg;
      return copy;
    });
  };

  const saveOne = async (d: Draft) => {
    setSaving(d.id);
    setError(d.id, null);
    try {
      const conditions = JSON.parse(d.conditionsText);
      const actions = JSON.parse(d.actionsText);

      const payload = {
        opco_id: opcoId,
        name: d.name,
        description: d.description,
        priority: d.priority,
        active: d.active,
        conditions,
        actions,
        updated_at: new Date().toISOString(),
      };

      if (d.isNew || (d.opco_id === null && opcoId !== null)) {
        // OpCo override: insert a new row scoped to this OpCo, same name.
        const { data: inserted, error: insErr } = await supabase
          .from("decision_engine_rules")
          .insert(payload)
          .select("*")
          .maybeSingle<DecisionRule>();
        if (insErr || !inserted) throw insErr ?? new Error("Insert failed");
        setDrafts((prev) =>
          prev.map((x) => (x.id === d.id ? toDraft(inserted) : x)),
        );
        setStatus((prev) => ({ ...prev, [inserted.id]: "OpCo override saved" }));
      } else {
        const { error: updErr } = await supabase
          .from("decision_engine_rules")
          .update(payload)
          .eq("id", d.id);
        if (updErr) throw updErr;
        setStatus((prev) => ({ ...prev, [d.id]: "Saved" }));
      }
      router.refresh();
    } catch (err) {
      setError(d.id, err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const deleteOne = async (d: Draft) => {
    if (d.opco_id === null) {
      setError(d.id, "Default rules cannot be deleted. Deactivate instead.");
      return;
    }
    if (!confirm(`Delete OpCo rule "${d.name}"?`)) return;
    try {
      const { error } = await supabase
        .from("decision_engine_rules")
        .delete()
        .eq("id", d.id);
      if (error) throw error;
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      router.refresh();
    } catch (err) {
      setError(d.id, err instanceof Error ? err.message : "Delete failed");
    }
  };

  const addRule = () => {
    const id = `new-${Math.random().toString(36).slice(2, 8)}`;
    const draft: Draft = {
      id,
      opco_id: opcoId,
      name: "New rule",
      description: "",
      priority: 50,
      active: true,
      conditions: { score_between: [60, 79] },
      actions: {
        create_opportunity: {
          type: "repair",
          priority: "normal",
          notes_template: "Score {{score}}.",
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      conditionsText: JSON.stringify({ score_between: [60, 79] }, null, 2),
      actionsText: JSON.stringify(
        {
          create_opportunity: {
            type: "repair",
            priority: "normal",
            notes_template: "Score {{score}}.",
          },
        },
        null,
        2,
      ),
      isNew: true,
    };
    setDrafts((prev) => [...prev, draft]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={addRule}>
          Add rule
        </Button>
      </div>

      <ul className="space-y-4">
        {drafts
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((d) => (
            <li
              key={d.id}
              className="rounded-md border border-brand-border bg-brand-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={d.opco_id ? "accent" : "outline"}>
                    {d.opco_id ? "OpCo" : "Default"}
                  </Badge>
                  <span className="label-mono">Priority {d.priority}</span>
                </div>
                <Checkbox
                  id={`active-${d.id}`}
                  checked={d.active}
                  onChange={(e) =>
                    updateDraft(d.id, {
                      active: (e.target as HTMLInputElement).checked,
                    })
                  }
                  label={<span className="text-xs">Active</span>}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px]">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={d.name}
                    onChange={(e) =>
                      updateDraft(d.id, { name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={d.priority}
                    onChange={(e) =>
                      updateDraft(d.id, { priority: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Label>Description</Label>
                <Input
                  value={d.description ?? ""}
                  onChange={(e) =>
                    updateDraft(d.id, { description: e.target.value })
                  }
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Conditions (JSON)</Label>
                  <textarea
                    value={d.conditionsText}
                    onChange={(e) =>
                      updateDraft(d.id, { conditionsText: e.target.value })
                    }
                    className="min-h-[140px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 font-mono text-xs text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Actions (JSON)</Label>
                  <textarea
                    value={d.actionsText}
                    onChange={(e) =>
                      updateDraft(d.id, { actionsText: e.target.value })
                    }
                    className="min-h-[140px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 font-mono text-xs text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => saveOne(d)}
                  disabled={saving === d.id}
                >
                  {saving === d.id
                    ? "Saving…"
                    : d.opco_id === null && opcoId !== null
                      ? "Save as OpCo override"
                      : "Save"}
                </Button>
                {d.opco_id !== null ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteOne(d)}
                  >
                    Delete
                  </Button>
                ) : null}
                {status[d.id] ? (
                  <span className="text-xs text-brand-success">
                    {status[d.id]}
                  </span>
                ) : null}
                {errors[d.id] ? (
                  <span className="text-xs text-brand-error">
                    {errors[d.id]}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
      </ul>

      <details className="rounded-md border border-brand-border bg-brand-card p-4 text-sm text-brand-muted">
        <summary className="cursor-pointer text-brand-primary">
          Condition and action reference
        </summary>
        <div className="mt-3 space-y-3 text-xs">
          <p>
            Conditions (all optional, all must match):{" "}
            <code>score_lte</code>, <code>score_gte</code>,{" "}
            <code>score_between: [lo, hi]</code>,{" "}
            <code>has_finding_severity: [&quot;severe&quot;, &quot;critical&quot;]</code>,{" "}
            <code>has_finding_category: &quot;water_staining&quot;</code>,{" "}
            <code>severity_gte: &quot;moderate&quot;</code>,{" "}
            <code>no_finding_severity_above: &quot;minor&quot;</code>,{" "}
            <code>roof_age_gte: 12</code>.
          </p>
          <p>
            Actions: <code>create_opportunity</code> and{" "}
            <code>create_opportunity_secondary</code> both take{" "}
            <code>{`{ type, priority, notes_template }`}</code>. Valid{" "}
            <code>type</code> values are <code>repair</code>,{" "}
            <code>rejuvenation</code>, <code>replacement_plan</code>,{" "}
            <code>warranty_claim</code>. <code>log_only: true</code> records
            activity with no opportunity.
          </p>
          <p>
            Template variables available in <code>notes_template</code>:{" "}
            <code>{`{{score}}`}</code>, <code>{`{{roof_age}}`}</code>,{" "}
            <code>{`{{band}}`}</code>.
          </p>
        </div>
      </details>
    </div>
  );
}
