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
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_ORDER,
  OPPORTUNITY_STAGE_VARIANTS,
  OPPORTUNITY_PRIORITY_LABELS,
  OPPORTUNITY_PRIORITY_VARIANTS,
  OPPORTUNITY_TYPE_LABELS,
} from "@/lib/labels";
import { canDragOpportunityStage } from "@/lib/rbac";
import type {
  Opportunity,
  OpportunityStage,
  Role,
} from "@/lib/types";
import { updateOpportunityStage } from "@/lib/opportunities/actions";

interface Props {
  opportunities: Opportunity[];
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
  userRoles: Role[];
}

export function OpportunityKanban({
  opportunities,
  memberMap,
  profileMap,
  userRoles,
}: Props) {
  const router = useRouter();
  const draggable = canDragOpportunityStage(userRoles);
  const [items, setItems] = React.useState(opportunities);
  const [active, setActive] = React.useState<Opportunity | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setItems(opportunities), [opportunities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const byStage = React.useMemo(() => {
    const map: Record<OpportunityStage, Opportunity[]> = {
      prospecting: [],
      quoted: [],
      scheduled: [],
      in_progress: [],
      completed: [],
      lost: [],
    };
    for (const o of items) {
      map[o.stage].push(o);
    }
    for (const k of Object.keys(map) as OpportunityStage[]) {
      map[k].sort((a, b) => a.stage_order - b.stage_order);
    }
    return map;
  }, [items]);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setActive(items.find((o) => o.id === id) ?? null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const nextStage = overId as OpportunityStage;
    const current = items.find((o) => o.id === id);
    if (!current || current.stage === nextStage) return;

    const optimistic = items.map((o) =>
      o.id === id ? { ...o, stage: nextStage } : o,
    );
    setItems(optimistic);

    try {
      await updateOpportunityStage({ id, stage: nextStage });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update stage");
      setItems(opportunities);
    }
  };

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-brand-error/30 bg-brand-error/5 px-3 py-2 text-xs text-brand-error">
          {error}
        </div>
      ) : null}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {OPPORTUNITY_STAGE_ORDER.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              items={byStage[stage]}
              memberMap={memberMap}
              profileMap={profileMap}
              draggable={draggable}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <OpportunityCardBody
              opportunity={active}
              memberMap={memberMap}
              profileMap={profileMap}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  stage,
  items,
  memberMap,
  profileMap,
  draggable,
}: {
  stage: OpportunityStage;
  items: Opportunity[];
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
  draggable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = items.reduce((sum, o) => sum + (o.value_estimate ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-md border border-brand-border bg-brand-card/60 transition-colors",
        isOver && "border-brand-accent bg-brand-accent/5",
      )}
    >
      <div className="flex items-center justify-between border-b border-brand-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant={OPPORTUNITY_STAGE_VARIANTS[stage]}>
            {OPPORTUNITY_STAGE_LABELS[stage]}
          </Badge>
          <span className="text-xs text-brand-muted">{items.length}</span>
        </div>
        {total > 0 ? (
          <span className="metric-figure text-xs text-brand-primary">
            ${Math.round(total).toLocaleString()}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-[200px] flex-col gap-2 p-2">
        {items.length === 0 ? (
          <p className="rounded border border-dashed border-brand-border px-3 py-6 text-center text-xs text-brand-faint">
            Drop here
          </p>
        ) : (
          items.map((o) => (
            <DraggableCard
              key={o.id}
              opportunity={o}
              memberMap={memberMap}
              profileMap={profileMap}
              draggable={draggable}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  opportunity,
  memberMap,
  profileMap,
  draggable,
}: {
  opportunity: Opportunity;
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        "cursor-grab touch-none select-none",
        isDragging && "opacity-30",
      )}
    >
      <OpportunityCardBody
        opportunity={opportunity}
        memberMap={memberMap}
        profileMap={profileMap}
      />
    </div>
  );
}

function OpportunityCardBody({
  opportunity,
  memberMap,
  profileMap,
  dragging = false,
}: {
  opportunity: Opportunity;
  memberMap: Record<string, string>;
  profileMap: Record<string, string>;
  dragging?: boolean;
}) {
  const daysInStage = opportunity.updated_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(opportunity.updated_at).getTime()) /
            86_400_000,
        ),
      )
    : 0;

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      prefetch={false}
      className={cn(
        "block rounded-md border border-brand-border bg-brand-card p-3 shadow-sm transition-colors hover:border-brand-border-strong",
        dragging && "shadow-lg border-brand-accent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-sm font-medium text-brand-primary">
          {opportunity.member_id
            ? (memberMap[opportunity.member_id] ?? "Unknown")
            : "—"}
        </p>
        <Badge variant={OPPORTUNITY_PRIORITY_VARIANTS[opportunity.priority]}>
          {OPPORTUNITY_PRIORITY_LABELS[opportunity.priority]}
        </Badge>
      </div>
      {opportunity.type ? (
        <p className="label-mono mt-1">
          {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between text-xs">
        {opportunity.value_estimate ? (
          <span className="metric-figure text-base text-brand-primary">
            ${Math.round(opportunity.value_estimate).toLocaleString()}
          </span>
        ) : (
          <span className="text-brand-faint">No estimate</span>
        )}
        <span className="text-brand-faint">{daysInStage}d</span>
      </div>
      {opportunity.assigned_to &&
      profileMap[opportunity.assigned_to] ? (
        <p className="mt-2 text-[11px] text-brand-muted">
          {profileMap[opportunity.assigned_to]}
        </p>
      ) : null}
      {opportunity.expected_close_date ? (
        <p className="mt-1 text-[11px] text-brand-faint">
          Close · {formatDate(opportunity.expected_close_date)}
        </p>
      ) : null}
    </Link>
  );
}
