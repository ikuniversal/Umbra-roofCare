"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Organization, Role } from "@/lib/types";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/rbac";

const schema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional().or(z.literal("")),
  opco_id: z.string().uuid({ message: "Select an OpCo" }),
  roles: z.array(z.string()).min(1, "Select at least one role"),
});

type Values = z.infer<typeof schema>;

interface InviteResponse {
  ok: boolean;
  tempPassword?: string;
  userId?: string;
  error?: string;
}

export function InviteUserButton({
  organizations,
  canChooseOpco,
  defaultOpcoId,
}: {
  organizations: Organization[];
  canChooseOpco: boolean;
  defaultOpcoId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      opco_id: defaultOpcoId ?? "",
      roles: [],
    },
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    setResult(null);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await res.json()) as InviteResponse;
    if (!res.ok || !data.ok) {
      setError(data.error || "Unable to invite user");
      return;
    }
    setResult({ email: values.email, tempPassword: data.tempPassword ?? "" });
    reset({
      full_name: "",
      email: "",
      phone: "",
      opco_id: defaultOpcoId ?? "",
      roles: [],
    });
    router.refresh();
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <UserPlus className="h-4 w-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            Create an account and grant roles. In Phase 1 you&apos;ll receive a
            temporary password to hand off manually — email invites ship in
            Phase 6.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-md border border-brand-success/30 bg-brand-success/5 p-4 text-sm">
              <p className="label-mono !text-brand-success">
                User created
              </p>
              <p className="mt-2 text-brand-primary">
                <span className="font-medium">{result.email}</span>
              </p>
              <div className="mt-3">
                <p className="label-mono">Temporary password</p>
                <code className="mt-1 block rounded bg-brand-bg px-3 py-2 font-mono text-sm text-brand-primary">
                  {result.tempPassword}
                </code>
                <p className="mt-2 text-xs text-brand-muted">
                  Share this with the user privately. They&apos;ll use it to
                  sign in for the first time.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" {...register("full_name")} />
                {errors.full_name ? (
                  <p className="text-xs text-brand-error">
                    {errors.full_name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email ? (
                  <p className="text-xs text-brand-error">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" {...register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>OpCo</Label>
                <Controller
                  control={control}
                  name="opco_id"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!canChooseOpco && !!defaultOpcoId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select OpCo" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.opco_id ? (
                  <p className="text-xs text-brand-error">
                    {errors.opco_id.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Roles</Label>
              <Controller
                control={control}
                name="roles"
                render={({ field }) => (
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-brand-border p-3">
                    {ROLES.map((role) => {
                      const checked = field.value.includes(role);
                      return (
                        <div
                          key={role}
                          className="flex items-start gap-3 py-1"
                        >
                          <Checkbox
                            id={`role-${role}`}
                            checked={checked}
                            onChange={(e) => {
                              const target =
                                e.target as HTMLInputElement;
                              if (target.checked) {
                                field.onChange([...field.value, role]);
                              } else {
                                field.onChange(
                                  field.value.filter(
                                    (r: string) => r !== role,
                                  ),
                                );
                              }
                            }}
                            label={
                              <span className="flex flex-col">
                                <span className="text-sm font-medium text-brand-primary">
                                  {ROLE_LABELS[role as Role]}
                                </span>
                                <span className="text-xs text-brand-muted">
                                  {ROLE_DESCRIPTIONS[role as Role]}
                                </span>
                              </span>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              />
              {errors.roles ? (
                <p className="text-xs text-brand-error">
                  {errors.roles.message as string}
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-xs text-brand-error">{error}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Inviting…" : "Invite user"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
