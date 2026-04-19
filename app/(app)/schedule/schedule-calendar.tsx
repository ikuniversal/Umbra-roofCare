"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  JOB_PRIORITY_VARIANTS,
  JOB_STATUS_LABELS,
  JOB_STATUS_VARIANTS,
  WEEKDAY_LABELS,
} from "@/lib/labels";
import type { Crew, CrewAvailability, Job } from "@/lib/types";
import { scheduleJob } from "@/lib/jobs/actions";

interface Props {
  weekStartISO: string;
  crews: Crew[];
  scheduled: Job[];
  unscheduled: Job[];
  availability: CrewAvailability[];
  memberMap: Record<string, string>;
  propertyMap: Record<string, string>;
}

const UNSCHEDULED_DROPPABLE_ID = "unscheduled";
const DAY_MS = 86_400_000;
const DEFAULT_DURATION_HOURS = 8;

function formatDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekDays(startISO: string): Date[] {
  const start = new Date(startISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function ScheduleCalendar({
  weekStartISO,
  crews,
  scheduled,
  unscheduled,
  availability,
  memberMap,
  propertyMap,
}: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState(scheduled);
  const [queue, setQueue] = React.useState(unscheduled);
  const [active, setActive] = React.useState<Job | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setItems(scheduled), [scheduled]);
  React.useEffect(() => setQueue(unscheduled), [unscheduled]);

  const days = React.useMemo(() => weekDays(weekStartISO), [weekStartISO]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const availabilityByCrew = React.useMemo(() => {
    const map: Record<string, CrewAvailability[]> = {};
    for (const a of availability) {
      (map[a.crew_id] ??= []).push(a);
    }
    return map;
  }, [availability]);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setActive(
      items.find((j) => j.id === id) ?? queue.find((j) => j.id === id) ?? null,
    );
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const jobId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    if (overId === UNSCHEDULED_DROPPABLE_ID) {
      const existing = items.find((j) => j.id === jobId);
      if (!existing) return;
      setItems((prev) => prev.filter((j) => j.id !== jobId));
      setQueue((prev) => [...prev, { ...existing, scheduled_start: null, crew_id: null, status: "ready_to_schedule" }]);
      try {
        await scheduleJob({
          id: jobId,
          crew_id: null,
          scheduled_start: null,
          scheduled_end: null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unassign failed");
        setItems(scheduled);
        setQueue(unscheduled);
      }
      return;
    }

    const [crewId, dayKey] = overId.split("|");
    if (!crewId || !dayKey) return;

    const existing = items.find((j) => j.id === jobId);
    const fromQueue = !existing;
    const start = new Date(`${dayKey}T08:00:00`);
    const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 3600_000);

    const targetJob = existing ?? queue.find((j) => j.id === jobId);
    if (!targetJob) return;

    const updated: Job = {
      ...targetJob,
      crew_id: crewId,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      status: targetJob.status === "in_progress" ? "in_progress" : "scheduled",
    };

    if (fromQueue) {
      setQueue((prev) => prev.filter((j) => j.id !== jobId));
      setItems((prev) => [...prev, updated]);
    } else {
      setItems((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    }

    try {
      await scheduleJob({
        id: jobId,
        crew_id: crewId,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
      setItems(scheduled);
      setQueue(unscheduled);
    }
  };

  const navigateWeek = (offsetDays: number) => {
    const d = new Date(weekStartISO);
    d.setDate(d.getDate() + offsetDays);
    router.push(`/schedule?start=${d.toISOString()}`);
  };

  const weekLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigateWeek(-7)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-serif text-xl text-brand-primary">{weekLabel}</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigateWeek(7)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/schedule")}
          >
            This week
          </Button>
        </div>
        {error ? (
          <p className="text-xs text-brand-error">{error}</p>
        ) : null}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <UnscheduledSidebar
            queue={queue}
            memberMap={memberMap}
          />
          <div className="overflow-x-auto rounded-md border border-brand-border bg-brand-card">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th className="label-mono sticky left-0 z-10 w-44 bg-brand-bg/80 px-3 py-3 text-left">
                    Crew
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.toISOString()}
                      className="label-mono border-l border-brand-border px-3 py-3 text-left"
                    >
                      {WEEKDAY_LABELS[d.getDay()]} ·{" "}
                      {d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crews.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-brand-muted"
                    >
                      No active crews. Create one in <Link href="/crews" className="text-brand-accent hover:underline">Crews</Link>.
                    </td>
                  </tr>
                ) : (
                  crews.map((c) => (
                    <tr key={c.id} className="border-t border-brand-border">
                      <td className="sticky left-0 z-10 w-44 border-r border-brand-border bg-brand-bg/60 px-3 py-3 align-top">
                        <p className="label-mono">{c.crew_code}</p>
                        <p className="font-serif text-sm text-brand-primary">
                          {c.name}
                        </p>
                      </td>
                      {days.map((d) => (
                        <CalendarCell
                          key={d.toISOString()}
                          crewId={c.id}
                          day={d}
                          jobs={items.filter((j) => {
                            if (j.crew_id !== c.id || !j.scheduled_start)
                              return false;
                            const start = new Date(j.scheduled_start);
                            return (
                              start >= d &&
                              start.getTime() < d.getTime() + DAY_MS
                            );
                          })}
                          availability={availabilityByCrew[c.id] ?? []}
                          memberMap={memberMap}
                          propertyMap={propertyMap}
                        />
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DragOverlay>
          {active ? (
            <JobCardBody
              job={active}
              memberMap={memberMap}
              propertyMap={propertyMap}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function UnscheduledSidebar({
  queue,
  memberMap,
}: {
  queue: Job[];
  memberMap: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED_DROPPABLE_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-brand-border bg-brand-card p-3",
        isOver && "border-brand-accent bg-brand-accent/5",
      )}
    >
      <p className="label-mono mb-2">Dispatch queue</p>
      {queue.length === 0 ? (
        <p className="rounded border border-dashed border-brand-border px-3 py-6 text-center text-xs text-brand-faint">
          Nothing unscheduled.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.map((j) => (
            <DraggableJob
              key={j.id}
              job={j}
              memberMap={memberMap}
              propertyMap={{}}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CalendarCell({
  crewId,
  day,
  jobs,
  availability,
  memberMap,
  propertyMap,
}: {
  crewId: string;
  day: Date;
  jobs: Job[];
  availability: CrewAvailability[];
  memberMap: Record<string, string>;
  propertyMap: Record<string, string>;
}) {
  const cellId = `${crewId}|${formatDayKey(day)}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  const weekday = day.getDay();
  const dayKey = formatDayKey(day);
  const working = availability.some(
    (a) => a.kind === "working_hours" && a.weekday === weekday,
  );
  const timeOff = availability.some(
    (a) =>
      a.kind !== "working_hours" &&
      a.start_date &&
      dayKey >= a.start_date &&
      (!a.end_date || dayKey <= a.end_date),
  );

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "min-w-[150px] border-l border-brand-border align-top",
        !working && "bg-brand-bg/30",
        timeOff && "bg-brand-warn/10",
        isOver && "bg-brand-accent/10",
      )}
    >
      <div className="min-h-[96px] space-y-2 p-2">
        {timeOff ? (
          <p className="label-mono !text-brand-warn">Time off</p>
        ) : null}
        {jobs.map((j) => (
          <DraggableJob
            key={j.id}
            job={j}
            memberMap={memberMap}
            propertyMap={propertyMap}
          />
        ))}
      </div>
    </td>
  );
}

function DraggableJob({
  job,
  memberMap,
  propertyMap,
}: {
  job: Job;
  memberMap: Record<string, string>;
  propertyMap: Record<string, string>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab touch-none",
        isDragging && "opacity-30",
      )}
    >
      <JobCardBody
        job={job}
        memberMap={memberMap}
        propertyMap={propertyMap}
      />
    </div>
  );
}

function JobCardBody({
  job,
  memberMap,
  propertyMap,
  dragging = false,
}: {
  job: Job;
  memberMap: Record<string, string>;
  propertyMap: Record<string, string>;
  dragging?: boolean;
}) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      prefetch={false}
      className={cn(
        "block rounded-md border border-brand-border bg-brand-card p-2 shadow-sm transition-colors",
        dragging && "border-brand-accent shadow-lg",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="font-serif text-xs font-medium text-brand-primary">
          {job.job_number ?? job.id.slice(0, 6)}
        </p>
        <Badge variant={JOB_PRIORITY_VARIANTS[job.priority]}>
          {job.priority}
        </Badge>
      </div>
      <p className="mt-1 truncate text-xs text-brand-muted">
        {job.member_id ? (memberMap[job.member_id] ?? "—") : "—"}
      </p>
      {job.property_id && propertyMap[job.property_id] ? (
        <p className="truncate text-[11px] text-brand-faint">
          {propertyMap[job.property_id]}
        </p>
      ) : null}
      <Badge variant={JOB_STATUS_VARIANTS[job.status]} className="mt-1">
        {JOB_STATUS_LABELS[job.status]}
      </Badge>
    </Link>
  );
}
