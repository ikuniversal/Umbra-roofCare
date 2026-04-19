import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canScheduleInspection } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Member, Profile, Property } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewInspectionForm } from "./new-inspection-form";

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ member_id?: string; property_id?: string; appointment_id?: string }>;
}) {
  const session = await requireSession();
  if (!canScheduleInspection(session.roles)) redirect("/inspections");
  const params = await searchParams;
  const supabase = await createClient();

  const [membersRes, propertiesRes, inspectorsRes] = await Promise.all([
    supabase
      .from("members")
      .select("id, first_name, last_name, status")
      .in("status", ["prospect", "member", "paused"])
      .order("last_name", { ascending: true })
      .limit(500),
    supabase
      .from("properties")
      .select("id, member_id, street, city, state, zip, roof_age_years"),
    supabase
      .from("profiles")
      .select("id, full_name, email"),
  ]);

  const members = (membersRes.data ?? []) as (Pick<
    Member,
    "id" | "first_name" | "last_name" | "status"
  >)[];
  const properties = (propertiesRes.data ?? []) as (Pick<
    Property,
    "id" | "member_id" | "street" | "city" | "state" | "zip" | "roof_age_years"
  >)[];
  const inspectors = (inspectorsRes.data ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email"
  >[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 3"
        title="Schedule inspection"
        description="Assign a member, a property, a time, and an inspector. The default 20-point template is applied automatically."
      />
      <Card className="mt-6">
        <CardContent className="p-6">
          <NewInspectionForm
            userId={session.userId}
            members={members}
            properties={properties}
            inspectors={inspectors}
            defaultMemberId={params.member_id}
            defaultPropertyId={params.property_id}
            defaultAppointmentId={params.appointment_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
