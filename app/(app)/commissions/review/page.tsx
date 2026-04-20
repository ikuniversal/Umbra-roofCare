import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canApproveCommissions } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Commission, Profile } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ApprovalQueue } from "./approval-queue";

export default async function CommissionReviewPage() {
  const session = await requireSession();
  if (!canApproveCommissions(session.roles)) redirect("/commissions");
  const supabase = await createClient();
  const [{ data: commissionsData }, { data: profilesData }] = await Promise.all(
    [
      supabase
        .from("commissions")
        .select("*")
        .eq("status", "pending")
        .order("earned_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email"),
    ],
  );
  const commissions = (commissionsData ?? []) as Commission[];
  const profileMap = Object.fromEntries(
    ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"],
    ),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Monetization · Phase 5"
        title="Approval queue"
        description="Review pending commissions and approve batches for payroll."
      />
      <Card className="mt-6">
        <CardContent className="p-0">
          <ApprovalQueue
            commissions={commissions}
            profileMap={profileMap}
          />
        </CardContent>
      </Card>
    </div>
  );
}
