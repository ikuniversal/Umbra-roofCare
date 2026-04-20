"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Crew, Profile } from "@/lib/types";
import { updateCrew } from "@/lib/crews/actions";

interface Props {
  crew: Crew;
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  canManage: boolean;
}

export function CrewEditForm({ crew, profiles, canManage }: Props) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    name: crew.name,
    lead_id: crew.lead_id ?? "",
    home_base: crew.home_base ?? "",
    specialties: (crew.specialties ?? []).join(", "),
    max_concurrent_jobs: crew.max_concurrent_jobs,
    active: crew.active,
  });
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateCrew({
        id: crew.id,
        name: values.name,
        lead_id: values.lead_id || null,
        home_base: values.home_base || null,
        specialties: values.specialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        max_concurrent_jobs: Number(values.max_concurrent_jobs) || 1,
        active: values.active,
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
        <p className="label-mono">Edit</p>
        <CardTitle>Crew info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={values.name}
              onChange={(e) =>
                setValues((p) => ({ ...p, name: e.target.value }))
              }
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label>Lead</Label>
            <Select
              value={values.lead_id}
              onValueChange={(v) =>
                setValues((p) => ({ ...p, lead_id: v }))
              }
              disabled={!canManage}
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
            <Label>Home base</Label>
            <Input
              value={values.home_base}
              onChange={(e) =>
                setValues((p) => ({ ...p, home_base: e.target.value }))
              }
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label>Max concurrent jobs</Label>
            <Input
              type="number"
              min={1}
              value={values.max_concurrent_jobs}
              onChange={(e) =>
                setValues((p) => ({
                  ...p,
                  max_concurrent_jobs: Number(e.target.value) || 1,
                }))
              }
              disabled={!canManage}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Specialties (comma-separated)</Label>
          <Input
            value={values.specialties}
            onChange={(e) =>
              setValues((p) => ({ ...p, specialties: e.target.value }))
            }
            disabled={!canManage}
          />
        </div>
        <Checkbox
          label="Active"
          checked={values.active}
          onChange={(e) =>
            setValues((p) => ({
              ...p,
              active: (e.target as HTMLInputElement).checked,
            }))
          }
          disabled={!canManage}
        />
        {canManage ? (
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save crew"}
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
