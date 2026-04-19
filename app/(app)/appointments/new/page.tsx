import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canBookAppointment } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { CanvassLead, Member, Profile } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentForm } from "../appointment-form";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ member_id?: string; lead_id?: string }>;
}) {
  const session = await requireSession();
  if (!canBookAppointment(session.roles)) redirect("/appointments");

  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: members }, { data: leads }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, first_name, last_name")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("canvass_leads")
        .select("id, address, status")
        .in("status", ["interested", "appointment_booked"])
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true }),
    ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Appointments · Phase 2"
        title="Book appointment"
        description="Schedule an enrollment, inspection, consultation, or follow-up."
      />
      <Card className="mt-8">
        <CardContent className="p-6">
          <AppointmentForm
            currentUserId={session.userId}
            defaultMemberId={params.member_id}
            defaultLeadId={params.lead_id}
            members={
              ((members ?? []) as Pick<
                Member,
                "id" | "first_name" | "last_name"
              >[]).map((m) => ({
                id: m.id,
                label: `${m.first_name} ${m.last_name}`,
              }))
            }
            leads={
              ((leads ?? []) as Pick<
                CanvassLead,
                "id" | "address" | "status"
              >[]).map((l) => ({
                id: l.id,
                label: l.address,
              }))
            }
            users={((profiles ?? []) as Pick<
              Profile,
              "id" | "full_name" | "email"
            >[]).map((p) => ({
              id: p.id,
              label: p.full_name ?? p.email ?? "Unknown",
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
