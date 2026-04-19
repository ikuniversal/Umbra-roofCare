import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Inspection, Member, Property } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InspectionStatusBadge } from "@/components/inspections/status-badges";
import { ScoreDisplay } from "@/components/inspections/score-display";
import { formatDateTime } from "@/lib/utils";

export default async function InspectorQueuePage() {
  const session = await requireSession();
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);

  const [mineRes, unassignedRes, membersRes, propsRes] = await Promise.all([
    supabase
      .from("inspections")
      .select("*")
      .eq("inspector_id", session.userId)
      .in("status", ["scheduled", "in_progress", "needs_review"])
      .order("scheduled_for", { ascending: true, nullsFirst: false }),
    supabase
      .from("inspections")
      .select("*")
      .is("inspector_id", null)
      .in("status", ["scheduled"])
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase.from("members").select("id, first_name, last_name"),
    supabase.from("properties").select("id, street, city, state"),
  ]);

  const mine = (mineRes.data ?? []) as Inspection[];
  const unassigned = (unassignedRes.data ?? []) as Inspection[];
  const memberMap = new Map<string, string>(
    ((membersRes.data ?? []) as Pick<Member, "id" | "first_name" | "last_name">[]).map(
      (m) => [m.id, `${m.first_name} ${m.last_name}`],
    ),
  );
  const propMap = new Map<string, string>(
    ((propsRes.data ?? []) as Pick<Property, "id" | "street" | "city" | "state">[]).map(
      (p) => [p.id, [p.street, p.city, p.state].filter(Boolean).join(", ")],
    ),
  );

  const todays = mine.filter(
    (i) =>
      i.scheduled_for &&
      new Date(i.scheduled_for) >= today &&
      new Date(i.scheduled_for) < tomorrow,
  );
  const thisWeek = mine.filter(
    (i) =>
      i.scheduled_for &&
      new Date(i.scheduled_for) >= tomorrow &&
      new Date(i.scheduled_for) < endOfWeek,
  );
  const inProgress = mine.filter((i) => i.status === "in_progress");
  const later = mine.filter(
    (i) => !i.scheduled_for || new Date(i.scheduled_for) >= endOfWeek,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Delivery · Phase 3"
        title="My inspection queue"
        description="Everything assigned to you, plus unclaimed work in your OpCo."
      />

      {inProgress.length > 0 ? (
        <Section
          title="In progress"
          count={inProgress.length}
          items={inProgress}
          memberMap={memberMap}
          propMap={propMap}
          emphasis
        />
      ) : null}

      <Section
        title="Today"
        count={todays.length}
        items={todays}
        memberMap={memberMap}
        propMap={propMap}
        empty="No inspections on the calendar for today."
      />

      <Section
        title="This week"
        count={thisWeek.length}
        items={thisWeek}
        memberMap={memberMap}
        propMap={propMap}
        empty="Nothing else scheduled this week."
      />

      {later.length > 0 ? (
        <Section
          title="Later"
          count={later.length}
          items={later}
          memberMap={memberMap}
          propMap={propMap}
        />
      ) : null}

      <Section
        title="Unassigned in my OpCo"
        count={unassigned.length}
        items={unassigned}
        memberMap={memberMap}
        propMap={propMap}
        empty="No unassigned inspections waiting for pickup."
      />
    </div>
  );
}

function Section({
  title,
  count,
  items,
  memberMap,
  propMap,
  empty,
  emphasis = false,
}: {
  title: string;
  count: number;
  items: Inspection[];
  memberMap: Map<string, string>;
  propMap: Map<string, string>;
  empty?: string;
  emphasis?: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl font-light text-brand-primary">
          {title}
        </h2>
        <p className="label-mono">{count}</p>
      </div>
      {items.length === 0 ? (
        empty ? (
          <p className="mt-3 rounded-md border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
            {empty}
          </p>
        ) : null
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={
                  i.status === "scheduled" || i.status === "in_progress"
                    ? `/inspections/${i.id}/capture`
                    : `/inspections/${i.id}`
                }
                className="block"
              >
                <Card
                  className={
                    emphasis
                      ? "border-brand-accent/60 transition-colors hover:border-brand-accent"
                      : "transition-colors hover:border-brand-border-strong"
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <p className="label-mono">
                        {formatDateTime(i.scheduled_for)}
                      </p>
                      <InspectionStatusBadge status={i.status} />
                    </div>
                    <CardTitle>
                      {i.member_id
                        ? (memberMap.get(i.member_id) ?? "Unknown member")
                        : "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-start justify-between gap-4 pt-0">
                    <p className="text-sm text-brand-muted">
                      {i.property_id
                        ? (propMap.get(i.property_id) ?? "—")
                        : "—"}
                    </p>
                    {i.overall_score !== null ? (
                      <ScoreDisplay
                        size="sm"
                        score={i.overall_score}
                        band={i.condition_band}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
