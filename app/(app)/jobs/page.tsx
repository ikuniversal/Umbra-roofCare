import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewJobs } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Crew,
  Job,
  JobStatus,
  Member,
  Property,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_VARIANTS,
  JOB_STATUS_LABELS,
  JOB_STATUS_VARIANTS,
  JOB_TYPE_LABELS,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const STATUSES: (JobStatus | "all")[] = [
  "all",
  "ready_to_schedule",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: JobStatus | "all"; crew?: string }>;
}) {
  const session = await requireSession();
  if (!canViewJobs(session.roles)) redirect("/dashboard");
  const params = await searchParams;
  const status = params.status ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select("*")
    .order("scheduled_start", { ascending: true, nullsFirst: false });
  if (status !== "all") query = query.eq("status", status);
  if (params.crew) query = query.eq("crew_id", params.crew);

  const [jobsRes, membersRes, propsRes, crewsRes] = await Promise.all([
    query,
    supabase.from("members").select("id, first_name, last_name"),
    supabase.from("properties").select("id, street, city, state"),
    supabase.from("crews").select("id, name, crew_code"),
  ]);
  const jobs = (jobsRes.data ?? []) as Job[];
  const memberMap = Object.fromEntries(
    ((membersRes.data ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).map(
      (m) => [m.id, `${m.first_name} ${m.last_name}`],
    ),
  );
  const propertyMap = Object.fromEntries(
    ((propsRes.data ?? []) as Pick<Property, "id" | "street" | "city" | "state">[]).map(
      (p) => [p.id, [p.street, p.city, p.state].filter(Boolean).join(", ")],
    ),
  );
  const crewMap = Object.fromEntries(
    ((crewsRes.data ?? []) as Pick<Crew, "id" | "name" | "crew_code">[]).map(
      (c) => [c.id, `${c.crew_code} · ${c.name}`],
    ),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 4"
        title="Jobs"
        description="Every job, from ready-to-schedule through completion."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/jobs" : `/jobs?status=${s}`}
            prefetch={false}
          >
            <Badge variant={status === s ? "primary" : "outline"}>
              {s === "all" ? "All" : JOB_STATUS_LABELS[s as JobStatus]}
            </Badge>
          </Link>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-brand-muted">
              No jobs for this filter.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bg/50">
                  <tr>
                    <th className="label-mono px-4 py-3">Job #</th>
                    <th className="label-mono px-4 py-3">Member</th>
                    <th className="label-mono px-4 py-3">Property</th>
                    <th className="label-mono px-4 py-3">Type</th>
                    <th className="label-mono px-4 py-3">Priority</th>
                    <th className="label-mono px-4 py-3">Status</th>
                    <th className="label-mono px-4 py-3">Crew</th>
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
                          {j.job_number ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {j.member_id
                          ? (memberMap[j.member_id] ?? "—")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {j.property_id
                          ? (propertyMap[j.property_id] ?? "—")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {j.job_type ? JOB_TYPE_LABELS[j.job_type] : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={JOB_PRIORITY_VARIANTS[j.priority]}>
                          {JOB_PRIORITY_LABELS[j.priority]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={JOB_STATUS_VARIANTS[j.status]}>
                          {JOB_STATUS_LABELS[j.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {j.crew_id ? (crewMap[j.crew_id] ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {formatDate(j.scheduled_start)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
