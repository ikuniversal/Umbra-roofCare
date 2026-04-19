"use client";

import { useMemo, useState, useTransition } from "react";
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
import { scheduleInspection } from "@/lib/inspections/actions";
import type { Member, Profile, Property } from "@/lib/types";

interface Props {
  userId: string;
  members: Pick<Member, "id" | "first_name" | "last_name" | "status">[];
  properties: Pick<
    Property,
    "id" | "member_id" | "street" | "city" | "state" | "zip" | "roof_age_years"
  >[];
  inspectors: Pick<Profile, "id" | "full_name" | "email">[];
  defaultMemberId?: string;
  defaultPropertyId?: string;
  defaultAppointmentId?: string;
}

export function NewInspectionForm({
  userId,
  members,
  properties,
  inspectors,
  defaultMemberId,
  defaultPropertyId,
  defaultAppointmentId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState<string>(defaultMemberId ?? "");
  const [propertyId, setPropertyId] = useState<string>(
    defaultPropertyId ?? "",
  );
  const [inspectorId, setInspectorId] = useState<string>(userId);
  const defaultTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  }, []);
  const [scheduledFor, setScheduledFor] = useState(defaultTime);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const memberProps = useMemo(
    () => properties.filter((p) => p.member_id === memberId),
    [memberId, properties],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!memberId || !propertyId || !scheduledFor) {
      setError("Pick a member, a property, and a time.");
      return;
    }
    const fd = new FormData();
    fd.set("member_id", memberId);
    fd.set("property_id", propertyId);
    fd.set("inspector_id", inspectorId);
    fd.set("scheduled_for", new Date(scheduledFor).toISOString());
    if (defaultAppointmentId) fd.set("appointment_id", defaultAppointmentId);
    if (notes) fd.set("notes", notes);

    startTransition(async () => {
      try {
        const id = await scheduleInspection(fd);
        router.push(`/inspections/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not schedule.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Member</Label>
        <Select
          value={memberId}
          onValueChange={(v) => {
            setMemberId(v);
            setPropertyId("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a member" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.first_name} {m.last_name} · {m.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Property</Label>
        <Select
          value={propertyId}
          onValueChange={setPropertyId}
          disabled={!memberId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                memberId
                  ? memberProps.length === 0
                    ? "No property on file"
                    : "Pick a property"
                  : "Pick a member first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {memberProps.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {[p.street, p.city, p.state].filter(Boolean).join(", ")}
                {p.roof_age_years ? ` · roof ${p.roof_age_years}y` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scheduled_for">Scheduled for</Label>
          <Input
            id="scheduled_for"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Inspector</Label>
          <Select value={inspectorId} onValueChange={setInspectorId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick inspector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={userId}>Me</SelectItem>
              {inspectors
                .filter((i) => i.id !== userId)
                .map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.full_name ?? i.email ?? "Unknown"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          placeholder="Context, access notes, prep instructions…"
        />
      </div>

      {error ? (
        <p className="text-xs text-brand-error">{error}</p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} variant="accent">
          {pending ? "Scheduling…" : "Schedule inspection"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inspections")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
