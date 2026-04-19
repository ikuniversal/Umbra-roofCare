import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canCreateMember } from "@/lib/rbac";
import type { Member, MemberStatus } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MembersFilters } from "./members-filters";
import { MembersTable } from "./members-table";

interface SearchParams {
  q?: string;
  status?: MemberStatus | "all";
  page?: string;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const PAGE_SIZE = 25;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("members")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.q) {
    const term = params.q.replace(/[%,]/g, "");
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  const { data, count, error } = await query;
  const members = (data ?? []) as Member[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <PageHeader
        eyebrow="Growth · Phase 2"
        title="Members"
        description="Every homeowner — prospects, active members, and those who've churned."
        actions={
          canCreateMember(session.roles) ? (
            <Button asChild variant="accent">
              <Link href="/members/new">New member</Link>
            </Button>
          ) : null
        }
      />

      <div className="mt-6 space-y-4">
        <MembersFilters
          defaultQuery={params.q ?? ""}
          defaultStatus={params.status ?? "all"}
        />

        {error ? (
          <div className="rounded-md border border-brand-error/30 bg-brand-error/5 p-4 text-sm text-brand-error">
            Failed to load members: {error.message}
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <MembersTable members={members} />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-sm text-brand-muted">
          <p>
            {count ?? 0} member{count === 1 ? "" : "s"} · page {page} of{" "}
            {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildPageLink({
                    q: params.q,
                    status: params.status,
                    page: page - 1,
                  })}
                >
                  Previous
                </Link>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildPageLink({
                    q: params.q,
                    status: params.status,
                    page: page + 1,
                  })}
                >
                  Next
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPageLink(args: {
  q?: string;
  status?: MemberStatus | "all";
  page: number;
}): string {
  const sp = new URLSearchParams();
  if (args.q) sp.set("q", args.q);
  if (args.status && args.status !== "all") sp.set("status", args.status);
  sp.set("page", String(args.page));
  return `/members?${sp.toString()}`;
}
