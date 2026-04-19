import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canCompleteJob } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Job, Member, Property } from "@/lib/types";
import { CompletionFlow } from "./completion-flow";

export default async function CompleteJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle<Job>();
  if (!job) notFound();

  const [{ data: crewMembers }, { data: member }, { data: property }] =
    await Promise.all([
      job.crew_id
        ? supabase
            .from("crew_members")
            .select("profile_id")
            .eq("crew_id", job.crew_id)
            .is("left_at", null)
        : Promise.resolve({ data: [] }),
      job.member_id
        ? supabase
            .from("members")
            .select("id, first_name, last_name")
            .eq("id", job.member_id)
            .maybeSingle<Pick<Member, "id" | "first_name" | "last_name">>()
        : Promise.resolve({ data: null }),
      job.property_id
        ? supabase
            .from("properties")
            .select("id, street, city, state")
            .eq("id", job.property_id)
            .maybeSingle<Pick<Property, "id" | "street" | "city" | "state">>()
        : Promise.resolve({ data: null }),
    ]);

  const memberIds = (crewMembers ?? []).map((r) => r.profile_id as string);
  if (!canCompleteJob(session.roles, job, session.userId, memberIds)) {
    redirect(`/jobs/${id}`);
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <CompletionFlow
        job={job}
        member={member}
        property={property}
        opcoId={job.opco_id ?? ""}
      />
    </div>
  );
}
