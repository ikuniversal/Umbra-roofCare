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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Crew, Job } from "@/lib/types";
import { scheduleJob } from "@/lib/jobs/actions";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function JobScheduleCard({
  job,
  crews,
  canSchedule,
}: {
  job: Job;
  crews: Pick<Crew, "id" | "name" | "crew_code">[];
  canSchedule: boolean;
}) {
  const router = useRouter();
  const [crewId, setCrewId] = React.useState(job.crew_id ?? "");
  const [start, setStart] = React.useState(toLocalInputValue(job.scheduled_start));
  const [end, setEnd] = React.useState(toLocalInputValue(job.scheduled_end));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await scheduleJob({
        id: job.id,
        crew_id: crewId || null,
        scheduled_start: start ? new Date(start).toISOString() : null,
        scheduled_end: end ? new Date(end).toISOString() : null,
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
        <p className="label-mono">Schedule</p>
        <CardTitle>Assign + schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Crew</Label>
          <Select value={crewId} onValueChange={setCrewId} disabled={!canSchedule}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {crews.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.crew_code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sched_start">Scheduled start</Label>
            <Input
              id="sched_start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={!canSchedule}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched_end">Scheduled end</Label>
            <Input
              id="sched_end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={!canSchedule}
            />
          </div>
        </div>
        {canSchedule ? (
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save schedule"}
            </Button>
            {status ? (
              <span className="text-xs text-brand-success">{status}</span>
            ) : null}
            {error ? (
              <span className="text-xs text-brand-error">{error}</span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-brand-muted">
            Read-only view for your role.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
