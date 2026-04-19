import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewOpportunities } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Member, Opportunity, Profile } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { OpportunityKanban } from "./opportunity-kanban";
import { OpportunityTable } from "./opportunity-table";

interface SearchParams {
  view?: "kanban" | "table";
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  if (!canViewOpportunities(session.roles)) redirect("/dashboard");
  const params = await searchParams;
  const view = params.view === "table" ? "table" : "kanban";
  const supabase = await createClient();

  const [{ data: oppData }, { data: membersData }, { data: profilesData }] =
    await Promise.all([
      supabase
        .from("opportunities")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("members").select("id, first_name, last_name"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const opportunities = (oppData ?? []) as Opportunity[];
  const memberMap = Object.fromEntries(
    ((membersData ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).map(
      (m) => [m.id, `${m.first_name} ${m.last_name}`],
    ),
  );
  const profileMap = Object.fromEntries(
    ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "Unknown"],
    ),
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title="Opportunities"
        description="Your pipeline — from Decision Engine handoff to scheduled work. Drag cards between stages."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/opportunities?view=kanban" prefetch={false}>
              <Badge variant={view === "kanban" ? "primary" : "outline"}>
                Kanban
              </Badge>
            </Link>
            <Link href="/opportunities?view=table" prefetch={false}>
              <Badge variant={view === "table" ? "primary" : "outline"}>
                Table
              </Badge>
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        {view === "kanban" ? (
          <OpportunityKanban
            opportunities={opportunities}
            memberMap={memberMap}
            profileMap={profileMap}
            userRoles={session.roles}
          />
        ) : (
          <OpportunityTable
            opportunities={opportunities}
            memberMap={memberMap}
            profileMap={profileMap}
          />
        )}
      </div>
    </div>
  );
}
