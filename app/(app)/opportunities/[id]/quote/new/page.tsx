import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canCreateQuote } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewQuoteForm } from "./new-quote-form";

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canCreateQuote(session.roles)) redirect(`/opportunities/${(await params).id}`);
  const { id } = await params;

  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, member_id, type")
    .eq("id", id)
    .maybeSingle<{ id: string; member_id: string | null; type: string | null }>();
  if (!opp) redirect("/opportunities");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title="New quote"
        description="Create a draft quote. You can add line items on the next screen."
      />
      <Card className="mt-6">
        <CardContent className="p-6">
          <NewQuoteForm opportunityId={opp.id} />
        </CardContent>
      </Card>
    </div>
  );
}
