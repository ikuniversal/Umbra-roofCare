import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canInitiatePayroll } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Commission, Profile } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayrollBatch } from "./payroll-batch";

export default async function PayrollPage() {
  const session = await requireSession();
  if (!canInitiatePayroll(session.roles)) redirect("/commissions");
  const supabase = await createClient();

  const [{ data: approved }, { data: profilesData }] = await Promise.all([
    supabase
      .from("commissions")
      .select("*")
      .eq("status", "approved")
      .order("earned_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const commissions = (approved ?? []) as Commission[];
  const profileMap = Object.fromEntries(
    ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"],
    ),
  );

  const thisMonth = new Date();
  const thisYear = thisMonth.getFullYear();
  const thisMonthNum = thisMonth.getMonth() + 1;
  const lastMonth = new Date(thisYear, thisMonthNum - 2, 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Monetization · Phase 5"
        title="Payroll"
        description="Run monthly overrides, mark approved commissions paid, export CSV batches."
      />

      <Card className="mt-6">
        <CardHeader>
          <p className="label-mono">Batch {commissions.length} approved commissions</p>
          <CardTitle>Ready for payroll</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollBatch
            commissions={commissions}
            profileMap={profileMap}
            defaultOverrideYear={lastMonth.getFullYear()}
            defaultOverrideMonth={lastMonth.getMonth() + 1}
          />
        </CardContent>
      </Card>
    </div>
  );
}
