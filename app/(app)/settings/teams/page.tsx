import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewSettings } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface TeamRow {
  id: string;
  name: string;
  opco_id: string | null;
  lead_user_id: string | null;
  created_at: string;
}

export default async function TeamsSettingsPage() {
  const session = await requireSession();
  if (!canViewSettings(session.roles)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, opco_id, lead_user_id, created_at")
    .order("created_at", { ascending: false });

  const teams = (data ?? []) as TeamRow[];

  return (
    <Card>
      <CardHeader>
        <p className="label-mono">Teams</p>
        <CardTitle>
          {teams.length ? `${teams.length} team${teams.length === 1 ? "" : "s"}` : "No teams yet"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="py-6 text-sm text-brand-muted">
            Team management UI lands in a later phase. The schema already
            supports teams, team memberships, and team leads; you can create
            rows directly via Supabase until the dedicated UI is built.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {teams.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-serif text-base text-brand-primary">
                    {t.name}
                  </p>
                  <p className="text-xs text-brand-muted">
                    Created {formatDate(t.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
