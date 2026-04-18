"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User, Settings as SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@/lib/types";

interface TopbarProps {
  userName: string | null;
  userEmail: string | null;
  roles: Role[];
  opcoName: string | null;
}

export function Topbar({ userName, userEmail, roles, opcoName }: TopbarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const primaryRole = roles[0];

  return (
    <header className="flex h-16 items-center justify-between border-b border-brand-border bg-brand-card px-6">
      <div className="flex items-center gap-3">
        {opcoName ? (
          <>
            <span className="label-mono">Viewing</span>
            <span className="font-serif text-base text-brand-primary">
              {opcoName}
            </span>
          </>
        ) : (
          <span className="label-mono">No OpCo assigned</span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-brand-bg focus:outline-none">
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-brand-primary">
              {userName ?? userEmail ?? "Unknown"}
            </p>
            {primaryRole ? (
              <p className="text-[11px] text-brand-muted">
                {ROLE_LABELS[primaryRole]}
              </p>
            ) : null}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-xs font-medium text-brand-bg">
            {initials(userName ?? userEmail)}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{userEmail ?? "Account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/settings/profile"
              className="flex items-center gap-2"
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="flex items-center gap-2 text-brand-error"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
