import { requireSession } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/rbac";

export default async function ProfileSettingsPage() {
  const session = await requireSession();

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <p className="label-mono">Profile</p>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              userId={session.userId}
              defaultValues={{
                full_name: session.profile?.full_name ?? "",
                phone: session.profile?.phone ?? "",
              }}
              email={session.email}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <p className="label-mono">Organization</p>
            <CardTitle>{session.organization?.name ?? "Unassigned"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-brand-muted">
            {session.organization ? (
              <>
                <p>Type: {session.organization.type.toUpperCase()}</p>
                {session.organization.state ? (
                  <p>State: {session.organization.state}</p>
                ) : null}
              </>
            ) : (
              <p>
                An administrator must assign you to an OpCo before full access
                is granted.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="label-mono">Roles</p>
            <CardTitle>
              {session.roles.length
                ? `${session.roles.length} assigned`
                : "None"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session.roles.length ? (
              <ul className="flex flex-wrap gap-2">
                {session.roles.map((r) => (
                  <li key={r}>
                    <Badge variant="primary">{ROLE_LABELS[r]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-muted">
                Your administrator hasn&apos;t granted any roles yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
