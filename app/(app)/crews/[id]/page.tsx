import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageCrews } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Crew,
  CrewAvailability,
  CrewMemberRow,
  Job,
  Profile,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_VARIANTS,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { CrewMembersEditor } from "./members-editor";
import { CrewAvailabilityEditor } from "./availability-editor";
import { CrewEditForm } from "./edit-form";

export default async function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const canManage = canManageCrews(session.roles);
  const { id } = await params;
  const supabase = await createClient();

  const { data: crew } = await supabase
    .from("crews")
    .select("*")
    .eq("id", id)
    .maybeSingle<Crew>();
  if (!crew) notFound();

  const [membersRes, availRes, jobsRes, profilesRes] = await Promise.all([
    supabase
      .from("crew_members")
      .select("*")
      .eq("crew_id", crew.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("crew_availability")
      .select("*")
      .eq("crew_id", crew.id)
      .order("weekday", { ascending: true, nullsFirst: true }),
    supabase
      .from("jobs")
      .select("id, job_number, status, scheduled_start, member_id")
      .eq("crew_id", crew.id)
      .order("scheduled_start", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const members = (membersRes.data ?? []) as CrewMemberRow[];
  const availability = (availRes.data ?? []) as CrewAvailability[];
  const jobs = (jobsRes.data ?? []) as Pick<
    Job,
    "id" | "job_number" | "status" | "scheduled_start" | "member_id"
  >[];
  const profiles = (profilesRes.data ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email"
  >[];
  const profileMap = Object.fromEntries(
    profiles.map((p) => [p.id, p.full_name ?? p.email ?? "—"]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title={crew.name}
        description={`${crew.crew_code}${crew.home_base ? ` · ${crew.home_base}` : ""}`}
        actions={
          <Badge variant={crew.active ? "success" : "outline"}>
            {crew.active ? "Active" : "Inactive"}
          </Badge>
        }
      />

      <Tabs defaultValue="members" className="mt-6">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="jobs">Assigned jobs</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <CrewMembersEditor
            crewId={crew.id}
            members={members}
            profiles={profiles}
            canManage={canManage}
            profileMap={profileMap}
          />
        </TabsContent>

        <TabsContent value="availability">
          <CrewAvailabilityEditor
            crewId={crew.id}
            availability={availability}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <p className="label-mono">Jobs</p>
              <CardTitle>{jobs.length}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-brand-muted">
                  No jobs assigned to this crew yet.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-brand-bg/60">
                    <tr>
                      <th className="label-mono px-4 py-3">Job</th>
                      <th className="label-mono px-4 py-3">Status</th>
                      <th className="label-mono px-4 py-3">Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr
                        key={j.id}
                        className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/jobs/${j.id}`}
                            className="font-serif text-base text-brand-primary hover:underline"
                          >
                            {j.job_number ?? j.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={JOB_STATUS_VARIANTS[j.status]}>
                            {JOB_STATUS_LABELS[j.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-brand-muted">
                          {formatDate(j.scheduled_start)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit">
          <CrewEditForm
            crew={crew}
            profiles={profiles}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
