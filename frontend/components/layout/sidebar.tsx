"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";
import { TeamSwitcher } from "./team-switcher";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex md:w-14 lg:w-56 flex-col bg-background border-r border-border">
      <div className="p-4">
        <h1 className="hidden lg:block text-lg font-semibold">
          Scoresheet Manager
        </h1>
        <div className="hidden lg:block mt-1">
          <TeamSwitcher />
        </div>
        <div className="lg:hidden flex items-center justify-center">
          <span className="text-lg font-semibold">SM</span>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 p-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150",
                    "hover:bg-accent/50",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden lg:block">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <UserMenu />
    </aside>
  );
}
