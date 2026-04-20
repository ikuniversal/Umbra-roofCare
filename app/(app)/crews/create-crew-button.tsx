"use client";

import * as React from "react";
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
import { createCrew } from "@/lib/crews/actions";

export function CreateCrewButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [specialties, setSpecialties] = React.useState("");
  const [homeBase, setHomeBase] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const id = await createCrew({
        name,
        crew_code: code.toUpperCase(),
        home_base: homeBase || null,
        specialties: specialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setOpen(false);
      router.push(`/crews/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">New crew</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New crew</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="crew-name">Name</Label>
            <Input
              id="crew-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DFW Alpha"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crew-code">Code</Label>
            <Input
              id="crew-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="DFW-A"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="home-base">Home base</Label>
            <Input
              id="home-base"
              value={homeBase}
              onChange={(e) => setHomeBase(e.target.value)}
              placeholder="Dallas, TX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialties">Specialties (comma-separated)</Label>
            <Input
              id="specialties"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="shingle, metal, tile"
            />
          </div>
          {error ? (
            <p className="text-xs text-brand-error">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !name || !code}
          >
            {pending ? "Creating…" : "Create crew"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
