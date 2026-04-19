import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canManageCrews } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Crew, Job, Profile } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateCrewButton } from "./create-crew-button";

export default async function CrewsPage() {
  const session = await requireSession();
  const canManage = canManageCrews(session.roles);

  const supabase = await createClient();
  const [{ data: crewsData }, { data: jobsData }, { data: profilesData }, { data: membersData }] =
    await Promise.all([
      supabase.from("crews").select("*").order("crew_code", { ascending: true }),
      supabase
        .from("jobs")
        .select("id, crew_id, status, job_number, scheduled_start"),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("crew_members").select("id, crew_id, profile_id, left_at"),
    ]);
  const crews = (crewsData ?? []) as Crew[];
  const jobs = (jobsData ?? []) as Pick<
    Job,
    "id" | "crew_id" | "status" | "job_number" | "scheduled_start"
  >[];
  const profileMap = Object.fromEntries(
    ((profilesData ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"],
    ),
  );
  const memberCounts: Record<string, number> = {};
  ((membersData ?? []) as {
    id: string;
    crew_id: string;
    profile_id: string;
    left_at: string | null;
  }[]).forEach((m) => {
    if (!m.left_at) {
      memberCounts[m.crew_id] = (memberCounts[m.crew_id] ?? 0) + 1;
    }
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title="Crews"
        description="Your field teams, their specialties, and their current dispatch."
        actions={canManage ? <CreateCrewButton /> : null}
      />

      {crews.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-brand-border px-4 py-10 text-center text-sm text-brand-muted">
          No crews yet.{" "}
          {canManage ? "Create the first one." : "Ask your OpCo GM to add one."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {crews.map((c) => {
            const current = jobs.find(
              (j) =>
                j.crew_id === c.id &&
                (j.status === "in_progress" ||
                  (j.status === "scheduled" &&
                    j.scheduled_start &&
                    new Date(j.scheduled_start).toDateString() ===
                      new Date().toDateString())),
            );
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <p className="label-mono">{c.crew_code}</p>
                    <Badge variant={c.active ? "success" : "outline"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardTitle>
                    <Link
                      href={`/crews/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row
                    label="Lead"
                    value={
                      c.lead_id ? (profileMap[c.lead_id] ?? "—") : "—"
                    }
                  />
                  <Row
                    label="Members"
                    value={`${memberCounts[c.id] ?? 0}`}
                  />
                  <Row
                    label="Home base"
                    value={c.home_base ?? "—"}
                  />
                  <Row
                    label="Specialties"
                    value={
                      c.specialties && c.specialties.length > 0
                        ? c.specialties.join(", ")
                        : "—"
                    }
                  />
                  <Row
                    label="Current job"
                    value={
                      current
                        ? (current.job_number ?? current.id.slice(0, 8))
                        : "—"
                    }
                  />
                  <div className="pt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/crews/${c.id}`}>Open crew</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="label-mono">{label}</p>
      <p className="text-brand-primary">{value}</p>
    </div>
  );
}
