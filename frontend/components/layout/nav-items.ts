import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Newspaper,
  Target,
  Layers,
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
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Draft", href: "/draft", icon: Target },
  { label: "Depth Charts", href: "/depth-charts", icon: Layers },
  { label: "Opponents", href: "/opponents", icon: Trophy },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MOBILE_PRIMARY_NAV = NAV_ITEMS.slice(0, 4);
export const MOBILE_OVERFLOW_NAV = NAV_ITEMS.slice(4); // Depth Charts, Opponents, Settings
