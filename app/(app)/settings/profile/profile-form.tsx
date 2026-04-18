"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  full_name: z.string().min(1, "Name is required").max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

export function ProfileForm({
  userId,
  defaultValues,
  email,
}: {
  userId: string;
  defaultValues: Values;
  email: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = async (values: Values) => {
    setStatus(null);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
      })
      .eq("id", userId);
    if (err) {
      setError(err.message);
      return;
    }
    setStatus("Saved");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email ?? ""} disabled readOnly />
        <p className="text-xs text-brand-faint">
          Contact your administrator to change your sign-in email.
        </p>
      </div>
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
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" {...register("phone")} />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        {status ? (
          <span className="text-xs text-brand-success">{status}</span>
        ) : null}
        {error ? (
          <span className="text-xs text-brand-error">{error}</span>
        ) : null}
      </div>
    </form>
  );
}
