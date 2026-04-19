import Link from "next/link";
import type { Member } from "@/lib/types";
import { MemberStatusBadge } from "@/components/status-badges";
import { formatDate, formatPhone } from "@/lib/utils";

export function MembersTable({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-brand-muted">
        No members match these filters yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-brand-bg/70 backdrop-blur">
          <tr>
            <th className="label-mono px-4 py-3">Name</th>
            <th className="label-mono hidden px-4 py-3 md:table-cell">Email</th>
            <th className="label-mono hidden px-4 py-3 md:table-cell">Phone</th>
            <th className="label-mono px-4 py-3">Status</th>
            <th className="label-mono hidden px-4 py-3 md:table-cell">Created</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              className="border-t border-brand-border transition-colors hover:bg-brand-bg/40"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/members/${m.id}`}
                  className="font-serif text-base text-brand-primary hover:underline"
                >
                  {m.first_name} {m.last_name}
                </Link>
              </td>
              <td className="hidden px-4 py-3 text-brand-muted md:table-cell">
                {m.email ?? "—"}
              </td>
              <td className="hidden px-4 py-3 text-brand-muted md:table-cell">
                {formatPhone(m.phone)}
              </td>
              <td className="px-4 py-3">
                <MemberStatusBadge status={m.status} />
              </td>
              <td className="hidden px-4 py-3 text-brand-muted md:table-cell">
                {formatDate(m.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
