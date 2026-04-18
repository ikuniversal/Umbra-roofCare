"use client";

import { useState } from "react";
import type { Organization } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { EditOrganizationDialog } from "./edit-organization-dialog";

export function OrganizationsTable({
  organizations,
}: {
  organizations: Organization[];
}) {
  const [editing, setEditing] = useState<Organization | null>(null);

  if (organizations.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-brand-muted">
        No organizations yet. Create the first OpCo to get started.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-brand-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-bg/50">
            <tr>
              <th className="label-mono px-4 py-3">Name</th>
              <th className="label-mono px-4 py-3">Slug</th>
              <th className="label-mono px-4 py-3">Type</th>
              <th className="label-mono px-4 py-3">State</th>
              <th className="label-mono px-4 py-3">Created</th>
              <th className="label-mono px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr
                key={org.id}
                className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
              >
                <td className="px-4 py-3">
                  <span className="font-serif text-base text-brand-primary">
                    {org.name}
                  </span>
                  {!org.active ? (
                    <span className="ml-2 text-xs text-brand-faint">
                      (inactive)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-brand-muted">
                  {org.slug}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={org.type === "holdco" ? "primary" : "accent"}
                  >
                    {org.type === "holdco" ? "HoldCo" : "OpCo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {org.state ?? "—"}
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {formatDate(org.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(org)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditOrganizationDialog
        organization={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
