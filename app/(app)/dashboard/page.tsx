import { requireSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await requireSession();
  const hasOpco = Boolean(session.opcoId);
  const hasRoles = session.roles.length > 0;
  const needsProvisioning = !hasOpco || !hasRoles;
  const displayName =
    session.profile?.full_name || session.email || "there";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${displayName.split(" ")[0]}`}
        description="Your workspace for subscription-first roof stewardship."
      />

      {needsProvisioning ? (
        <div className="mt-8 rounded-lg border border-brand-warn/30 bg-brand-warn/5 p-6">
          <p className="label-mono !text-brand-warn">Account pending setup</p>
          <h3 className="mt-2 font-serif text-xl text-brand-primary">
            Awaiting administrator provisioning
          </h3>
          <p className="mt-2 max-w-xl text-sm text-brand-muted">
            Your administrator needs to assign you to an OpCo and a role before
            you can access the platform. Please contact them to complete setup.
          </p>
        </div>
      ) : null}

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="label-mono">Identity</p>
            <CardTitle>{session.profile?.full_name ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="label-mono">Email</p>
              <p className="mt-1 text-brand-primary">{session.email ?? "—"}</p>
            </div>
            <div>
              <p className="label-mono">Phone</p>
              <p className="mt-1 text-brand-primary">
                {session.profile?.phone ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="label-mono">Organization</p>
            <CardTitle>
              {session.organization?.name ?? "Not assigned"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="label-mono">Type</p>
              <p className="mt-1 text-brand-primary">
                {session.organization?.type
                  ? session.organization.type === "holdco"
                    ? "HoldCo"
                    : "OpCo"
                  : "—"}
              </p>
            </div>
            <div>
              <p className="label-mono">State</p>
              <p className="mt-1 text-brand-primary">
                {session.organization?.state ?? "—"}
              </p>
            </div>
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
                {session.roles.map((role) => (
                  <li key={role}>
                    <Badge variant="primary">{ROLE_LABELS[role]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-muted">
                No roles have been granted yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-12">
        <p className="label-mono">Platform roadmap</p>
        <h2 className="mt-2 font-serif text-2xl font-light text-brand-primary">
          What ships in later phases
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            { phase: 2, title: "Members, Canvass, Appointments" },
            { phase: 3, title: "Scored Inspections" },
            { phase: 4, title: "Opportunities & Jobs" },
            { phase: 5, title: "Commissions & Payouts" },
            { phase: 6, title: "Communications" },
            { phase: 7, title: "Reports & Analytics" },
          ].map((p) => (
            <div
              key={p.phase}
              className="rounded-lg border border-brand-border bg-brand-card p-4"
            >
              <p className="label-mono">Phase {p.phase}</p>
              <p className="mt-2 font-serif text-lg text-brand-primary">
                {p.title}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
