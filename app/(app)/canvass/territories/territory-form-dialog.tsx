"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import type { Territory } from "@/lib/types";
import { upsertTerritory } from "../actions";

export function TerritoryFormDialog({
  existing,
}: {
  existing?: Territory;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      try {
        await upsertTerritory(existing?.id ?? null, formData);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="outline" size="sm">
            Edit
          </Button>
        ) : (
          <Button variant="accent">
            <Plus className="h-4 w-4" />
            New territory
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit territory" : "New territory"}
          </DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={existing?.name ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip_codes">ZIP codes (comma separated)</Label>
            <Input
              id="zip_codes"
              name="zip_codes"
              placeholder="75201, 75202, 75204"
              defaultValue={existing?.zip_codes?.join(", ") ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_doors">Estimated doors</Label>
            <Input
              id="total_doors"
              name="total_doors"
              type="number"
              min={0}
              defaultValue={existing?.total_doors ?? ""}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-primary">
            <input
              type="checkbox"
              name="active"
              defaultChecked={existing ? existing.active : true}
              className="h-4 w-4 rounded border-brand-border-strong"
            />
            Active
          </label>
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
              {isPending ? "Saving…" : existing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
