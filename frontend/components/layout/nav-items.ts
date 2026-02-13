import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Target,
  Trophy,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Players", href: "/players", icon: Users },
  { label: "Draft", href: "/draft", icon: Target },
  { label: "Opponents", href: "/opponents", icon: Trophy },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MOBILE_PRIMARY_NAV = NAV_ITEMS.slice(0, 3);
export const MOBILE_OVERFLOW_NAV = NAV_ITEMS.slice(3);
