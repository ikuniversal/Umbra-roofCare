import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canBookAppointment } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  Member,
  Profile,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentsView } from "./appointments-view";
import { AppointmentsFilters } from "./appointments-filters";

interface SearchParams {
  type?: AppointmentType | "all";
  status?: AppointmentStatus | "all";
  mode?: "calendar" | "list";
  assigned?: string;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const params = await searchParams;
  const mode = params.mode === "calendar" ? "calendar" : "list";

  let query = supabase
    .from("appointments")
    .select("*")
    .order("scheduled_for", { ascending: true });

  if (params.type && params.type !== "all") query = query.eq("type", params.type);
  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.assigned) query = query.eq("assigned_to", params.assigned);

  const [{ data: apptData }, { data: membersData }, { data: profilesData }] =
    await Promise.all([
      query,
      supabase.from("members").select("id, first_name, last_name"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
  const appointments = (apptData ?? []) as Appointment[];
  const memberMap = new Map<string, string>();
  ((membersData ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).forEach(
    (m) => memberMap.set(m.id, `${m.first_name} ${m.last_name}`),
  );
  const profileMap = new Map<string, string>();
  ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).forEach(
    (p) => profileMap.set(p.id, p.full_name ?? p.email ?? "Unknown"),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Growth · Phase 2"
        title="Appointments"
        description="Enrollments, inspections, consultations, and follow-ups across every assigned teammate."
        actions={
          canBookAppointment(session.roles) ? (
            <Button asChild variant="accent">
              <Link href="/appointments/new">Book appointment</Link>
            </Button>
          ) : null
        }
      />

      <div className="mt-6 space-y-4">
        <AppointmentsFilters
          mode={mode}
          type={params.type ?? "all"}
          status={params.status ?? "all"}
        />
        <Card>
          <CardContent className="p-0">
            <AppointmentsView
              appointments={appointments}
              memberMap={Object.fromEntries(memberMap)}
              profileMap={Object.fromEntries(profileMap)}
              mode={mode}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
