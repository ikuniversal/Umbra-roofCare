"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { MEMBER_STATUS_LABELS, ROOF_MATERIAL_LABELS } from "@/lib/labels";
import type {
  AddressResult,
  Member,
  MemberStatus,
  Property,
  RoofMaterial,
} from "@/lib/types";
import { createMember, updateMember } from "./actions";

interface MemberFormProps {
  mode: "create" | "edit";
  member?: Member;
  primaryProperty?: Property | null;
  fromLeadId?: string;
  prefillAddress?: string;
  onSaved?: () => void;
}

export function MemberForm({
  mode,
  member,
  primaryProperty,
  fromLeadId,
  prefillAddress,
}: MemberFormProps) {
  const [address, setAddress] = useState<AddressResult>({
    street: primaryProperty?.street ?? prefillAddress ?? "",
    city: primaryProperty?.city ?? "",
    state: primaryProperty?.state ?? "",
    zip: primaryProperty?.zip ?? "",
  });
  const [status, setStatus] = useState<MemberStatus>(
    member?.status ?? "prospect",
  );
  const [roofMaterial, setRoofMaterial] = useState<RoofMaterial | "">(
    primaryProperty?.roof_material ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    formData.set("status", status);
    formData.set("street", address.street);
    formData.set("city", address.city);
    formData.set("state", address.state);
    formData.set("zip", address.zip);
    formData.set("roof_material", roofMaterial);
    if (fromLeadId) formData.set("from_lead_id", fromLeadId);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createMember(formData);
        } else if (member) {
          await updateMember(member.id, formData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  return (
    <form action={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <h3 className="font-serif text-lg text-brand-primary">
          Homeowner details
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input
              id="first_name"
              name="first_name"
              required
              defaultValue={member?.first_name ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              name="last_name"
              required
              defaultValue={member?.last_name ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={member?.email ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={member?.phone ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_contact">Preferred contact</Label>
            <Select
              name="preferred_contact"
              defaultValue={member?.preferred_contact ?? "email"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              name="source"
              defaultValue={member?.source ?? (fromLeadId ? "canvass" : "inbound")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="canvass">Canvass</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "prospect",
                  "member",
                  "paused",
                  "cancelled",
                  "churned",
                ] as MemberStatus[]
              ).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatus(s)}
                  className={
                    "rounded-full border px-3 py-1 text-xs transition-colors " +
                    (status === s
                      ? "border-brand-primary bg-brand-primary text-brand-bg"
                      : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary")
                  }
                >
                  {MEMBER_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={member?.tags?.join(", ") ?? ""}
              placeholder="referral, high-value"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-serif text-lg text-brand-primary">
          Primary property
        </h3>
        <AddressAutocomplete
          id="property-address"
          defaultValue={address.street}
          onSelect={(addr) => setAddress(addr)}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={address.city}
              onChange={(e) =>
                setAddress((a) => ({ ...a, city: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={address.state}
              maxLength={2}
              onChange={(e) =>
                setAddress((a) => ({ ...a, state: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP</Label>
            <Input
              id="zip"
              value={address.zip}
              onChange={(e) =>
                setAddress((a) => ({ ...a, zip: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Roof material</Label>
            <Select
              value={roofMaterial || undefined}
              onValueChange={(v) => setRoofMaterial(v as RoofMaterial)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(ROOF_MATERIAL_LABELS) as [
                    RoofMaterial,
                    string,
                  ][]
                ).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="roof_age_years">Roof age (yrs)</Label>
            <Input
              id="roof_age_years"
              name="roof_age_years"
              type="number"
              min={0}
              defaultValue={primaryProperty?.roof_age_years ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="square_footage">Square footage</Label>
            <Input
              id="square_footage"
              name="square_footage"
              type="number"
              min={0}
              defaultValue={primaryProperty?.square_footage ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stories">Stories</Label>
            <Input
              id="stories"
              name="stories"
              type="number"
              min={1}
              max={6}
              defaultValue={primaryProperty?.stories ?? 1}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-brand-primary">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="has_solar"
              defaultChecked={primaryProperty?.has_solar ?? false}
              className="h-4 w-4 rounded border-brand-border-strong"
            />
            Solar panels
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="has_skylights"
              defaultChecked={primaryProperty?.has_skylights ?? false}
              className="h-4 w-4 rounded border-brand-border-strong"
            />
            Skylights
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="has_chimney"
              defaultChecked={primaryProperty?.has_chimney ?? false}
              className="h-4 w-4 rounded border-brand-border-strong"
            />
            Chimney
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-brand-error/30 bg-brand-error/5 p-3 text-sm text-brand-error">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="accent" disabled={isPending}>
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create member"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
