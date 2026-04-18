import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(params.next || "/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col items-stretch md:flex-row">
      <div className="relative hidden flex-1 bg-brand-primary p-12 md:flex md:flex-col md:justify-between">
        <Logo variant="inverse" size="lg" />
        <div className="max-w-md">
          <p className="label-mono !text-brand-bg/60">Editorial CRM · Est. 2026</p>
          <h1 className="mt-6 font-serif text-4xl font-light leading-tight text-brand-bg">
            Subscription-first roof stewardship.
          </h1>
          <p className="mt-6 text-sm leading-relaxed text-brand-bg/70">
            Umbra RoofCare coordinates inspections, maintenance, and priority
            service across regional OpCos — built for field teams who treat
            every roof as a long relationship.
          </p>
        </div>
        <div className="label-mono !text-brand-bg/40">
          Umbra HoldCo · v0.1 · Pilot
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-brand-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Logo size="md" />
          </div>
          <div className="mt-8 md:mt-0">
            <p className="label-mono">Sign in</p>
            <h2 className="mt-2 font-serif text-3xl font-light text-brand-primary">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-brand-muted">
              Access is invite-only. Your administrator provisions your
              account.
            </p>
          </div>

          <LoginForm
            nextPath={params.next ?? "/dashboard"}
            errorParam={params.error}
          />
        </div>
      </div>
    </div>
  );
}
