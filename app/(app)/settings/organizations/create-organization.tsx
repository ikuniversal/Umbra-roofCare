"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  type: z.enum(["holdco", "opco"]),
  state: z.string().max(2).optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

export function CreateOrganizationButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", type: "opco", state: "" },
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("organizations").insert({
      name: values.name,
      slug: values.slug,
      type: values.type,
      state: values.state || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <Plus className="h-4 w-4" />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Add a new HoldCo or regional OpCo subsidiary.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Umbra RoofCare Austin"
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-brand-error">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="umbra-atx"
              {...register("slug")}
            />
            {errors.slug ? (
              <p className="text-xs text-brand-error">{errors.slug.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                defaultValue="opco"
                onValueChange={(v) =>
                  setValue("type", v as Values["type"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opco">OpCo</SelectItem>
                  <SelectItem value="holdco">HoldCo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                maxLength={2}
                placeholder="TX"
                {...register("state")}
              />
            </div>
          </div>

          {error ? (
            <p className="text-xs text-brand-error">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
