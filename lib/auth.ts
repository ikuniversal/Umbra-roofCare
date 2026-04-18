import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile, Role, SessionContext } from "@/lib/types";

export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles: Role[] = (roleRows ?? []).map((r) => r.role as Role);

  let organization: Organization | null = null;
  if (profile?.opco_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.opco_id)
      .maybeSingle<Organization>();
    organization = org ?? null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    roles,
    opcoId: profile?.opco_id ?? null,
    organization,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(
  role: Role | Role[],
): Promise<SessionContext> {
  const session = await requireSession();
  const wanted = Array.isArray(role) ? role : [role];
  const ok = session.roles.some((r) => wanted.includes(r));
  if (!ok) redirect("/dashboard");
  return session;
}
