import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canInviteUsers, isSuperAdmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile, Role } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteUserButton } from "./invite-user";
import { UsersTable } from "./users-table";

interface UserRoleRow {
  user_id: string;
  role: Role;
  opco_id: string | null;
}

export default async function UsersSettingsPage() {
  const session = await requireSession();
  if (!canInviteUsers(session.roles)) redirect("/dashboard");

  const supabase = await createClient();

  const orgsQuery = supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  const profilesQuery = isSuperAdmin(session.roles)
    ? supabase.from("profiles").select("*").order("created_at", { ascending: false })
    : supabase
        .from("profiles")
        .select("*")
        .eq("opco_id", session.opcoId ?? "")
        .order("created_at", { ascending: false });

  const rolesQuery = supabase.from("user_roles").select("user_id, role, opco_id");

  const [{ data: orgsData }, { data: profilesData }, { data: rolesData }] =
    await Promise.all([orgsQuery, profilesQuery, rolesQuery]);

  const organizations = (orgsData ?? []) as Organization[];
  const profiles = (profilesData ?? []) as Profile[];
  const roleRows = (rolesData ?? []) as UserRoleRow[];

  const rolesByUser: Record<string, Role[]> = {};
  roleRows.forEach((r) => {
    if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
    rolesByUser[r.user_id].push(r.role);
  });

  const invitableOrgs = isSuperAdmin(session.roles)
    ? organizations.filter((o) => o.type === "opco")
    : organizations.filter((o) => o.id === session.opcoId);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-mono">Team</p>
          <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
            Users
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            Invite new users, assign them to an OpCo, and grant roles.
          </p>
        </div>
        <InviteUserButton
          organizations={invitableOrgs}
          canChooseOpco={isSuperAdmin(session.roles)}
          defaultOpcoId={session.opcoId}
        />
      </div>

      <Card>
        <CardHeader>
          <p className="label-mono">All users</p>
          <CardTitle>{profiles.length}</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersTable
            profiles={profiles}
            organizations={organizations}
            rolesByUser={rolesByUser}
          />
        </CardContent>
      </Card>
    </div>
  );
}
