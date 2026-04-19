"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CREW_AVAILABILITY_KIND_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { CrewAvailability, CrewAvailabilityKind } from "@/lib/types";
import { addAvailability, removeAvailability } from "@/lib/crews/actions";

interface Props {
  crewId: string;
  availability: CrewAvailability[];
  canManage: boolean;
}

export function CrewAvailabilityEditor({
  crewId,
  availability,
  canManage,
}: Props) {
  const router = useRouter();
  const [kind, setKind] = React.useState<CrewAvailabilityKind>("working_hours");
  const [weekday, setWeekday] = React.useState<string>("1");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("07:00");
  const [endTime, setEndTime] = React.useState("17:00");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hours = availability.filter((a) => a.kind === "working_hours");
  const offs = availability.filter((a) => a.kind !== "working_hours");

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await addAvailability({
        crew_id: crewId,
        kind,
        weekday: kind === "working_hours" ? Number(weekday) : null,
        start_date: kind === "working_hours" ? null : startDate || null,
        end_date: kind === "working_hours" ? null : endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        notes: notes || null,
      });
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this availability block?")) return;
    setPending(true);
    try {
      await removeAvailability({ id, crew_id: crewId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <p className="label-mono">Working hours</p>
          <CardTitle>Weekly schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {hours.length === 0 ? (
            <p className="text-sm text-brand-muted">
              No working hours set. The crew is considered closed until one is
              added.
            </p>
          ) : (
            <ul className="divide-y divide-brand-border">
              {hours.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="primary">
                      {h.weekday !== null
                        ? WEEKDAY_LABELS[h.weekday]
                        : "—"}
                    </Badge>
                    <span className="text-brand-primary">
                      {h.start_time?.slice(0, 5)} – {h.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      className="rounded-full border border-brand-border p-1 text-brand-muted hover:text-brand-error"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="label-mono">Time off + holidays</p>
          <CardTitle>{offs.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {offs.length === 0 ? (
            <p className="text-sm text-brand-muted">Nothing on the books.</p>
          ) : (
            <ul className="divide-y divide-brand-border">
              {offs.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {CREW_AVAILABILITY_KIND_LABELS[h.kind]}
                    </Badge>
                    <span className="text-brand-primary">
                      {formatDate(h.start_date)}
                      {h.end_date ? ` – ${formatDate(h.end_date)}` : ""}
                    </span>
                    {h.notes ? (
                      <span className="text-xs text-brand-muted">
                        {h.notes}
                      </span>
                    ) : null}
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      className="rounded-full border border-brand-border p-1 text-brand-muted hover:text-brand-error"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <p className="label-mono">Add availability</p>
            <CardTitle>New entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as CrewAvailabilityKind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working_hours">Working hours</SelectItem>
                    <SelectItem value="time_off">Time off</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "working_hours" ? (
                <div className="space-y-2">
                  <Label>Weekday</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_LABELS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            {kind === "working_hours" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context"
              />
            </div>
            {error ? (
              <p className="text-xs text-brand-error">{error}</p>
            ) : null}
            <Button onClick={submit} disabled={pending} variant="accent">
              {pending ? "Adding…" : "Add entry"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
