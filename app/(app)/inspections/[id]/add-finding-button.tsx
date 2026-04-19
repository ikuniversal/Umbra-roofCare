"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINDING_CATEGORIES,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_ORDER,
} from "@/lib/labels";
import { addFinding } from "@/lib/inspections/actions";
import type { FindingSeverity } from "@/lib/types";

export function AddFindingButton({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("shingle");
  const [severity, setSeverity] = useState<FindingSeverity>("moderate");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [repair, setRepair] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setCategory("shingle");
    setSeverity("moderate");
    setDescription("");
    setLocation("");
    setRepair("");
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (!description.trim()) {
      setError("Write a description.");
      return;
    }
    startTransition(async () => {
      try {
        await addFinding({
          inspectionId,
          category,
          severity,
          description: description.trim(),
          location: location.trim() || undefined,
          estimatedRepairCents: repair ? Math.round(Number(repair) * 100) : undefined,
        });
        setOpen(false);
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save finding.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          Add finding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New finding</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINDING_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as FindingSeverity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINDING_SEVERITY_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {FINDING_SEVERITY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="South slope, chimney, attic…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repair">Estimated repair ($)</Label>
              <Input
                id="repair"
                inputMode="decimal"
                value={repair}
                onChange={(e) => setRepair(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {error ? <p className="text-xs text-brand-error">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save finding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
