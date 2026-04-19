import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canCreateMember } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { CanvassLead } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MemberForm } from "../member-form";

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ from_lead?: string }>;
}) {
  const session = await requireSession();
  if (!canCreateMember(session.roles)) redirect("/members");

  const params = await searchParams;
  let lead: CanvassLead | null = null;
  if (params.from_lead) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("canvass_leads")
      .select("*")
      .eq("id", params.from_lead)
      .maybeSingle();
    lead = (data ?? null) as CanvassLead | null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Members · Phase 2"
        title={lead ? "Convert lead to member" : "New member"}
        description={
          lead
            ? `Pre-filled from ${lead.address}. Review before creating.`
            : "Add a homeowner and their primary property."
        }
      />
      <Card className="mt-8">
        <CardContent className="p-6">
          <MemberForm
            mode="create"
            fromLeadId={lead?.id}
            prefillAddress={lead?.address}
          />
        </CardContent>
      </Card>
    </div>
  );
}
