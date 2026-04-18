"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({
  nextPath,
  errorParam,
}: {
  nextPath: string;
  errorParam?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(
    errorParam ?? null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push(nextPath || "/dashboard");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-8 space-y-5"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-brand-error">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-brand-error">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <div className="rounded-md border border-brand-error/30 bg-brand-error/5 px-3 py-2 text-xs text-brand-error">
          {serverError}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="pt-2 text-center text-xs text-brand-faint">
        Need access? Contact your administrator.
      </p>
    </form>
  );
}
