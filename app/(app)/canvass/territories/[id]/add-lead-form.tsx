"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import type { AddressResult } from "@/lib/types";
import { createLead } from "../../actions";

export function AddLeadForm({ territoryId }: { territoryId: string }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState<AddressResult>({
    street: "",
    city: "",
    state: "",
    zip: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    const full = [address.street, address.city, address.state, address.zip]
      .filter(Boolean)
      .join(", ");
    formData.set("address", full || address.street);
    formData.set("territory_id", territoryId);
    startTransition(async () => {
      try {
        await createLead(formData);
        setOpen(false);
        setAddress({ street: "", city: "", state: "", zip: "" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          Add lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add canvass lead</DialogTitle>
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
          {error ? <p className="text-sm text-brand-error">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
