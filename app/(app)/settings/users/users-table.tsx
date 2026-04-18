"use client";

import type { Organization, Profile, Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export function UsersTable({
  profiles,
  organizations,
  rolesByUser,
}: {
  profiles: Profile[];
  organizations: Organization[];
  rolesByUser: Record<string, Role[]>;
}) {
  const orgById = new Map(organizations.map((o) => [o.id, o]));

  if (profiles.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-brand-muted">
        No users yet. Invite the first teammate.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-brand-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-bg/50">
          <tr>
            <th className="label-mono px-4 py-3">Name</th>
            <th className="label-mono px-4 py-3">Email</th>
            <th className="label-mono px-4 py-3">OpCo</th>
            <th className="label-mono px-4 py-3">Roles</th>
            <th className="label-mono px-4 py-3">Joined</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => {
            const roles = rolesByUser[p.id] ?? [];
            const org = p.opco_id ? orgById.get(p.opco_id) : null;
            return (
              <tr
                key={p.id}
                className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
              >
                <td className="px-4 py-3">
                  <span className="font-serif text-base text-brand-primary">
                    {p.full_name ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {p.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {org?.name ?? (
                    <span className="text-brand-faint">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {roles.length ? (
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r) => (
                        <Badge key={r} variant="outline">
                          {ROLE_LABELS[r]}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-brand-faint">No roles</span>
                  )}
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {formatDate(p.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
