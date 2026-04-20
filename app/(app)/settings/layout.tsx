import Link from "next/link";
import { requireSession } from "@/lib/auth";
import {
  canEditDecisionRules,
  canEditInspectionTemplate,
  canInviteUsers,
  canManageOrganizations,
  canManageStripeSettings,
  canManageSubscriptionPlans,
  canViewSettings,
} from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const showOrgs = canManageOrganizations(session.roles);
  const showUsers = canInviteUsers(session.roles);
  const showTeams = canViewSettings(session.roles);
  const showTemplate = canEditInspectionTemplate(session.roles);
  const showRules = canEditDecisionRules(session.roles);
  const showStripe = canManageStripeSettings(session.roles);
  const showPlans = canManageSubscriptionPlans(session.roles);

  const tabs: { href: string; label: string; show: boolean }[] = [
    { href: "/settings/profile", label: "Profile", show: true },
    { href: "/settings/organizations", label: "Organizations", show: showOrgs },
    { href: "/settings/users", label: "Users", show: showUsers },
    { href: "/settings/teams", label: "Teams", show: showTeams },
    {
      href: "/settings/inspection-template",
      label: "Inspection template",
      show: showTemplate,
    },
    {
      href: "/settings/decision-engine",
      label: "Decision engine",
      show: showRules,
    },
    {
      href: "/settings/subscription-plans",
      label: "Plans",
      show: showPlans,
    },
    { href: "/settings/stripe", label: "Stripe", show: showStripe },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Manage your profile, organizations, users, and teams."
      />
      <nav className="mt-6 flex gap-6 border-b border-brand-border">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="-mb-px border-b-2 border-transparent px-1 py-3 text-sm text-brand-muted transition-colors hover:border-brand-accent hover:text-brand-primary aria-[current=page]:border-brand-primary aria-[current=page]:text-brand-primary"
            >
              {t.label}
            </Link>
          ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
