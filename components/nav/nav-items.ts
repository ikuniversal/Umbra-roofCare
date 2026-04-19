import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Map,
  MapPinned,
  MessagesSquare,
  Settings,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  phase?: number;
  roles?: Role[] | "all";
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: "all",
      },
    ],
  },
  {
    heading: "Growth",
    items: [
      {
        label: "Members",
        href: "/members",
        icon: Users,
        phase: 2,
        roles: "all",
      },
      {
        label: "Canvass",
        href: "/canvass",
        icon: MapPinned,
        phase: 2,
        roles: [
          "super_admin",
          "executive",
          "corp_dev",
          "opco_gm",
          "sales_manager",
          "area_manager",
          "team_lead",
          "setter",
          "cra",
        ],
      },
      {
        label: "Territories",
        href: "/canvass/territories",
        icon: Map,
        phase: 2,
        roles: [
          "super_admin",
          "executive",
          "corp_dev",
          "opco_gm",
          "sales_manager",
        ],
      },
      {
        label: "Appointments",
        href: "/appointments",
        icon: CalendarDays,
        phase: 2,
        roles: "all",
      },
    ],
  },
  {
    heading: "Delivery",
    items: [
      {
        label: "Inspections",
        href: "/inspections",
        icon: ClipboardCheck,
        roles: "all",
      },
      {
        label: "Opportunities",
        href: "/opportunities",
        icon: Sparkles,
        phase: 4,
        roles: [
          "super_admin",
          "executive",
          "corp_dev",
          "opco_gm",
          "sales_manager",
          "area_manager",
          "specialist",
          "csm",
        ],
      },
      {
        label: "Jobs",
        href: "/jobs",
        icon: Wrench,
        phase: 4,
        roles: "all",
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      {
        label: "Commissions",
        href: "/commissions",
        icon: Banknote,
        phase: 5,
        roles: [
          "super_admin",
          "executive",
          "corp_dev",
          "opco_gm",
          "sales_manager",
          "area_manager",
          "team_lead",
          "cra",
          "setter",
          "specialist",
          "csm",
        ],
      },
      {
        label: "Messages",
        href: "/messages",
        icon: MessagesSquare,
        phase: 6,
        roles: "all",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        phase: 7,
        roles: [
          "super_admin",
          "executive",
          "corp_dev",
          "opco_gm",
          "sales_manager",
          "area_manager",
        ],
      },
    ],
  },
  {
    heading: "Admin",
    items: [
      {
        label: "Settings",
        href: "/settings/profile",
        icon: Settings,
        roles: "all",
      },
      {
        label: "Teams",
        href: "/settings/teams",
        icon: Briefcase,
        roles: [
          "super_admin",
          "executive",
          "corp_dev",
          "opco_gm",
          "sales_manager",
          "area_manager",
        ],
      },
    ],
  },
];

export function filterNav(
  sections: NavSection[],
  userRoles: Role[],
): NavSection[] {
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        if (item.roles === "all" || !item.roles) return true;
        return item.roles.some((r) => userRoles.includes(r));
      }),
    }))
    .filter((s) => s.items.length > 0);
}
