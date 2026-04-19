"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { NoteEntry } from "@/lib/types";

interface NotesPanelProps {
  entityType: string;
  entityId: string;
  opcoId: string | null;
  userId: string;
  notes: NoteEntry[];
  authorNames: Record<string, string>;
  canAdd?: boolean;
}

export function NotesPanel({
  entityType,
  entityId,
  opcoId,
  userId,
  notes,
  authorNames,
  canAdd = true,
}: NotesPanelProps) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addNote = async () => {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("notes").insert({
      entity_type: entityType,
      entity_id: entityId,
      body: text,
      opco_id: opcoId,
      created_by: userId,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {canAdd ? (
        <div className="space-y-2">
          <Label htmlFor={`note-${entityId}`}>Add a note</Label>
          <textarea
            id={`note-${entityId}`}
            className="min-h-[96px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            placeholder="What happened, what changed, what's next…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={saving}
          />
          {error ? (
            <p className="text-xs text-brand-error">{error}</p>
          ) : null}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={addNote}
              disabled={saving || !body.trim()}
            >
              {saving ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-brand-border bg-brand-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-brand-primary whitespace-pre-wrap">
                  {n.body}
                </p>
                <span className="shrink-0 text-[11px] text-brand-faint">
                  {formatDateTime(n.created_at)}
                </span>
              </div>
              <p className="label-mono mt-2">
                {n.created_by ? authorNames[n.created_by] ?? "Unknown" : "System"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
