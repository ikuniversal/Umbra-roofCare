import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar roles={session.roles} opcoName={session.organization?.name ?? null} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          userName={session.profile?.full_name ?? null}
          userEmail={session.email}
          roles={session.roles}
          opcoName={session.organization?.name ?? null}
        />
        <main className="flex-1 overflow-y-auto bg-brand-bg">{children}</main>
      </div>
    </div>
  );
}
