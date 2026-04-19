"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { ROOF_MATERIAL_LABELS } from "@/lib/labels";
import type { AddressResult, Property, RoofMaterial } from "@/lib/types";
import { upsertProperty } from "../actions";

interface PropertyFormProps {
  memberId: string;
  existing?: Property | null;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}

export function PropertyForm({
  memberId,
  existing,
  triggerLabel,
  triggerVariant = "outline",
}: PropertyFormProps) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState<AddressResult>({
    street: existing?.street ?? "",
    city: existing?.city ?? "",
    state: existing?.state ?? "",
    zip: existing?.zip ?? "",
  });
  const [roofMaterial, setRoofMaterial] = useState<RoofMaterial | "">(
    existing?.roof_material ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    formData.set("street", address.street);
    formData.set("city", address.city);
    formData.set("state", address.state);
    formData.set("zip", address.zip);
    formData.set("roof_material", roofMaterial);
    if (existing?.id) formData.set("property_id", existing.id);
    startTransition(async () => {
      try {
        await upsertProperty(memberId, formData);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          {triggerLabel ?? (existing ? "Edit property" : "Add property")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit property" : "Add property"}
          </DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <AddressAutocomplete
            defaultValue={address.street}
            onSelect={(addr) => setAddress(addr)}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={address.city}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                maxLength={2}
                value={address.state}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, state: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input
                value={address.zip}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, zip: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Material</Label>
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
              <Label htmlFor="roof_age_years">Age (yrs)</Label>
              <Input
                id="roof_age_years"
                name="roof_age_years"
                type="number"
                min={0}
                defaultValue={existing?.roof_age_years ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="square_footage">Sq ft</Label>
              <Input
                id="square_footage"
                name="square_footage"
                type="number"
                min={0}
                defaultValue={existing?.square_footage ?? ""}
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
                defaultValue={existing?.stories ?? 1}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-brand-primary">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_primary"
                defaultChecked={existing?.is_primary ?? true}
                className="h-4 w-4 rounded border-brand-border-strong"
              />
              Primary
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="has_solar"
                defaultChecked={existing?.has_solar ?? false}
                className="h-4 w-4 rounded border-brand-border-strong"
              />
              Solar
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="has_skylights"
                defaultChecked={existing?.has_skylights ?? false}
                className="h-4 w-4 rounded border-brand-border-strong"
              />
              Skylights
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="has_chimney"
                defaultChecked={existing?.has_chimney ?? false}
                className="h-4 w-4 rounded border-brand-border-strong"
              />
              Chimney
            </label>
          </div>
          {error ? (
            <p className="text-sm text-brand-error">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
