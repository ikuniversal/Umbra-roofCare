import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canScheduleJob } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Crew,
  CrewAvailability,
  Job,
  Member,
  Property,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { ScheduleCalendar } from "./schedule-calendar";

function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const session = await requireSession();
  if (!canScheduleJob(session.roles)) redirect("/jobs");
  const params = await searchParams;
  const anchor = params.start ? new Date(params.start) : new Date();
  const start = weekStart(anchor);
  const end = addDays(start, 7);

  const supabase = await createClient();
  const [
    { data: crewsData },
    { data: jobsInRange },
    { data: unscheduledJobs },
    { data: availabilityData },
    { data: membersData },
    { data: propsData },
  ] = await Promise.all([
    supabase
      .from("crews")
      .select("*")
      .eq("active", true)
      .order("crew_code", { ascending: true }),
    supabase
      .from("jobs")
      .select("*")
      .gte("scheduled_start", start.toISOString())
      .lt("scheduled_start", end.toISOString())
      .not("status", "in", "(cancelled,completed)")
      .order("scheduled_start", { ascending: true }),
    supabase
      .from("jobs")
      .select("*")
      .is("scheduled_start", null)
      .eq("status", "ready_to_schedule")
      .limit(50),
    supabase.from("crew_availability").select("*"),
    supabase.from("members").select("id, first_name, last_name"),
    supabase.from("properties").select("id, street, city"),
  ]);

  const crews = (crewsData ?? []) as Crew[];
  const inRange = (jobsInRange ?? []) as Job[];
  const unscheduled = (unscheduledJobs ?? []) as Job[];
  const availability = (availabilityData ?? []) as CrewAvailability[];
  const memberMap = Object.fromEntries(
    ((membersData ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).map(
      (m) => [m.id, `${m.first_name} ${m.last_name}`],
    ),
  );
  const propertyMap = Object.fromEntries(
    ((propsData ?? []) as Pick<Property, "id" | "street" | "city">[]).map(
      (p) => [p.id, [p.street, p.city].filter(Boolean).join(", ")],
    ),
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title="Schedule"
        description="Drag from the dispatch queue onto a crew + day cell to assign."
      />
      <div className="mt-6">
        <ScheduleCalendar
          weekStartISO={start.toISOString()}
          crews={crews}
          scheduled={inRange}
          unscheduled={unscheduled}
          availability={availability}
          memberMap={memberMap}
          propertyMap={propertyMap}
        />
      </div>
    </div>
  );
}
