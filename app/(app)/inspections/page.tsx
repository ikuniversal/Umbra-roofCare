import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canScheduleInspection } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Inspection,
  InspectionStatus,
  Member,
  Profile,
  Property,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InspectionsFilters } from "./inspections-filters";
import { InspectionsTable } from "./inspections-table";

interface SearchParams {
  status?: InspectionStatus | "all";
  range?: "today" | "week" | "month" | "all";
  mine?: string;
}

function rangeBounds(range: SearchParams["range"]): {
  from: string | null;
  to: string | null;
} {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  if (range === "today") {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 1);
    return { from: startOfDay.toISOString(), to: end.toISOString() };
  }
  if (range === "month") {
    const end = new Date(startOfDay);
    end.setDate(end.getDate() + 30);
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - 30);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (range === "all") {
    return { from: null, to: null };
  }
  // week (default)
  const start = new Date(startOfDay);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const supabase = await createClient();

  const range = params.range ?? "week";
  const { from, to } = rangeBounds(range);

  let query = supabase
    .from("inspections")
    .select("*")
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  if (from && to) {
    query = query
      .gte("scheduled_for", from)
      .lt("scheduled_for", to);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.mine === "1") {
    query = query.eq("inspector_id", session.userId);
  }

  const [
    { data: inspectionsData },
    { data: membersData },
    { data: profilesData },
    { data: propertiesData },
  ] = await Promise.all([
    query,
    supabase.from("members").select("id, first_name, last_name"),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("properties").select("id, street, city, state, zip"),
  ]);

  const inspections = (inspectionsData ?? []) as Inspection[];
  const memberMap = new Map<string, string>();
  ((membersData ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).forEach(
    (m) => memberMap.set(m.id, `${m.first_name} ${m.last_name}`),
  );
  const profileMap = new Map<string, string>();
  ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).forEach(
    (p) => profileMap.set(p.id, p.full_name ?? p.email ?? "Unknown"),
  );
  const propertyMap = new Map<string, Pick<Property, "street" | "city" | "state" | "zip">>();
  (
    (propertiesData ?? []) as Pick<Property, "id" | "street" | "city" | "state" | "zip">[]
  ).forEach((p) => propertyMap.set(p.id, p));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 3"
        title="Inspections"
        description="Scored condition reports driving the Decision Engine — healthy to critical, at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/inspections/queue">My queue</Link>
            </Button>
            {canScheduleInspection(session.roles) ? (
              <Button asChild variant="accent">
                <Link href="/inspections/new">Schedule inspection</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 space-y-4">
        <InspectionsFilters
          status={params.status ?? "all"}
          range={range}
          mine={params.mine === "1"}
        />

        <Card>
          <CardContent className="p-0">
            <InspectionsTable
              inspections={inspections}
              memberMap={Object.fromEntries(memberMap)}
              profileMap={Object.fromEntries(profileMap)}
              propertyMap={Object.fromEntries(
                Array.from(propertyMap, ([k, v]) => [k, v]),
              )}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
