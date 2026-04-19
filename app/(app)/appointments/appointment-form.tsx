"use client";

import { useState, useTransition } from "react";
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
import { APPOINTMENT_TYPE_LABELS } from "@/lib/labels";
import type { AppointmentType } from "@/lib/types";
import { createAppointment } from "./actions";

interface Option {
  id: string;
  label: string;
}

interface Props {
  currentUserId: string;
  defaultMemberId?: string;
  defaultLeadId?: string;
  members: Option[];
  leads: Option[];
  users: Option[];
}

export function AppointmentForm({
  currentUserId,
  defaultMemberId,
  defaultLeadId,
  members,
  leads,
  users,
}: Props) {
  const [type, setType] = useState<AppointmentType>("enrollment");
  const [memberId, setMemberId] = useState<string>(defaultMemberId ?? "");
  const [leadId, setLeadId] = useState<string>(defaultLeadId ?? "");
  const [assignedTo, setAssignedTo] = useState<string>(currentUserId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const submit = (formData: FormData) => {
    formData.set("type", type);
    formData.set("member_id", memberId);
    formData.set("lead_id", leadId);
    formData.set("assigned_to", assignedTo);
    startTransition(async () => {
      try {
        await createAppointment(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <form action={submit} className="space-y-5">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(APPOINTMENT_TYPE_LABELS) as [
              AppointmentType,
              string,
            ][]).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="scheduled_date">Date</Label>
          <Input
            id="scheduled_date"
            name="scheduled_date"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduled_time">Time</Label>
          <Input
            id="scheduled_time"
            name="scheduled_time"
            type="time"
            defaultValue="10:00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duration (min)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={15}
            max={480}
            step={15}
            defaultValue={60}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Member</Label>
          <Select
            value={memberId || undefined}
            onValueChange={(v) => {
              setMemberId(v);
              setLeadId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select member (or leave empty)" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Or lead</Label>
          <Select
            value={leadId || undefined}
            onValueChange={(v) => {
              setLeadId(v);
              setMemberId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a warm lead" />
            </SelectTrigger>
            <SelectContent>
              {leads.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assigned to</Label>
        <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          placeholder="What to expect, what to bring…"
        />
      </div>

      {error ? (
        <p className="text-sm text-brand-error">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="accent" disabled={isPending}>
          {isPending ? "Booking…" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
