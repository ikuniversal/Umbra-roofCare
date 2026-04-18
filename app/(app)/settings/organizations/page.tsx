import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageOrganizations } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrganizationsTable } from "./organizations-table";
import { CreateOrganizationButton } from "./create-organization";

export default async function OrganizationsSettingsPage() {
  const session = await requireSession();
  if (!canManageOrganizations(session.roles)) redirect("/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const organizations = (data ?? []) as Organization[];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-mono">Platform</p>
          <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
            Organizations
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            Manage the HoldCo and each OpCo subsidiary. OpCos isolate data via
            row-level security.
          </p>
        </div>
        <CreateOrganizationButton />
      </div>

      {error ? (
        <div className="rounded-md border border-brand-error/30 bg-brand-error/5 p-4 text-sm text-brand-error">
          Failed to load organizations: {error.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <p className="label-mono">All organizations</p>
          <CardTitle className="flex items-center gap-3">
            {organizations.length}
            <Badge variant="default">
              {organizations.filter((o) => o.type === "holdco").length} HoldCo
              · {organizations.filter((o) => o.type === "opco").length} OpCo
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationsTable organizations={organizations} />
        </CardContent>
      </Card>
    </div>
  );
}
