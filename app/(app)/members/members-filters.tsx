"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MEMBER_STATUS_LABELS } from "@/lib/labels";
import type { MemberStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: (MemberStatus | "all")[] = [
  "all",
  "prospect",
  "member",
  "paused",
  "cancelled",
  "churned",
];

export function MembersFilters({
  defaultQuery,
  defaultStatus,
}: {
  defaultQuery: string;
  defaultStatus: MemberStatus | "all";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [, startTransition] = useTransition();

  const apply = (status: MemberStatus | "all", q = query) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (q) sp.set("q", q);
    else sp.delete("q");
    if (status && status !== "all") sp.set("status", status);
    else sp.delete("status");
    sp.delete("page");
    startTransition(() => {
      router.push(`/members?${sp.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(defaultStatus);
        }}
        className="flex flex-1 items-center gap-2"
      >
        <Input
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = (defaultStatus ?? "all") === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => apply(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-brand-primary bg-brand-primary text-brand-bg"
                  : "border-brand-border-strong bg-brand-card text-brand-muted hover:text-brand-primary",
              )}
            >
              {s === "all" ? "All" : MEMBER_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
