"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_SECTIONS, filterNav } from "./nav-items";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface SidebarProps {
  roles: Role[];
  opcoName: string | null;
}

export function Sidebar({ roles, opcoName }: SidebarProps) {
  const pathname = usePathname();
  const sections = filterNav(NAV_SECTIONS, roles);

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-brand-primary/40 bg-brand-primary text-brand-bg md:flex">
      <div className="border-b border-brand-bg/10 px-6 py-6">
        <Link href="/dashboard" className="inline-block">
          <Logo variant="inverse" size="md" />
        </Link>
        {opcoName ? (
          <p className="label-mono mt-4 !text-brand-bg/60">{opcoName}</p>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.heading} className="mb-6">
            <p className="label-mono mb-2 px-3 !text-brand-bg/50">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-brand-bg/10 text-brand-bg"
                          : "text-brand-bg/70 hover:bg-brand-bg/5 hover:text-brand-bg",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-colors",
                          active
                            ? "text-brand-accent"
                            : "text-brand-bg/50 group-hover:text-brand-bg/80",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.phase ? (
                        <span className="rounded-sm border border-brand-bg/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-brand-bg/50">
                          P{item.phase}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-brand-bg/10 px-6 py-4">
        <p className="label-mono !text-brand-bg/50">
          Phase 3 · Inspection Engine
        </p>
        <p className="mt-1 font-serif text-sm text-brand-bg/80">
          v0.3 · Pilot
        </p>
      </div>
    </aside>
  );
}
