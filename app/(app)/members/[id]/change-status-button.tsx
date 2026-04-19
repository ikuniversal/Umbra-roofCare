"use client";

import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MEMBER_STATUS_LABELS } from "@/lib/labels";
import type { MemberStatus } from "@/lib/types";
import { setMemberStatus } from "../actions";

const STATUSES: MemberStatus[] = [
  "prospect",
  "member",
  "paused",
  "cancelled",
  "churned",
];

export function ChangeStatusButton({
  memberId,
  current,
}: {
  memberId: string;
  current: MemberStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const choose = (s: MemberStatus) => {
    if (s === current) return;
    startTransition(async () => {
      try {
        await setMemberStatus(memberId, s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {isPending ? "Updating…" : "Change status"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUSES.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => choose(s)}
              disabled={s === current}
            >
              {MEMBER_STATUS_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span className="text-xs text-brand-error">{error}</span> : null}
    </div>
  );
}
