"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(2).max(120),
  state: z.string().max(2).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  contractor_license_number: z.string().max(60).optional().or(z.literal("")),
  active: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function EditOrganizationDialog({
  organization,
  onClose,
}: {
  organization: Organization | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      state: "",
      phone: "",
      email: "",
      contractor_license_number: "",
      active: true,
    },
  });

  useEffect(() => {
    if (organization) {
      reset({
        name: organization.name,
        state: organization.state ?? "",
        phone: organization.phone ?? "",
        email: organization.email ?? "",
        contractor_license_number:
          organization.contractor_license_number ?? "",
        active: organization.active,
      });
    }
  }, [organization, reset]);

  if (!organization) return null;

  const onSubmit = async (values: Values) => {
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("organizations")
      .update({
        name: values.name,
        state: values.state || null,
        phone: values.phone || null,
        email: values.email || null,
        contractor_license_number: values.contractor_license_number || null,
        active: values.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organization.id);
    if (err) {
      setError(err.message);
      return;
    }
    onClose();
    router.refresh();
  };

  return (
    <Dialog
      open={Boolean(organization)}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {organization.name}</DialogTitle>
          <DialogDescription>
            Type ({organization.type}) and slug ({organization.slug}) are
            immutable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...register("name")} />
            {errors.name ? (
              <p className="text-xs text-brand-error">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-state">State</Label>
              <Input id="edit-state" maxLength={2} {...register("state")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" {...register("phone")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" {...register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-license">Contractor license #</Label>
            <Input
              id="edit-license"
              {...register("contractor_license_number")}
            />
          </div>
          <Checkbox label="Active" {...register("active")} />

          {error ? (
            <p className="text-xs text-brand-error">{error}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
