"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_PRIMARY_NAV, MOBILE_OVERFLOW_NAV } from "./nav-items";
import { TeamSwitcher } from "./team-switcher";

export function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setShowMore(false);
      }
    };

    if (showMore) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMore]);

  return (
    <nav
      aria-label="Mobile navigation"
      className="flex md:hidden fixed bottom-0 inset-x-0 h-14 bg-background border-t border-border z-10"
    >
      <div className="flex w-full items-center justify-around">
        {MOBILE_PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors duration-150",
                active
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}

        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            aria-label="More"
            aria-expanded={showMore}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors duration-150",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs">More</span>
          </button>

          {showMore && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-background border border-border rounded-md shadow-lg z-20">
              <div className="px-3 py-2 border-b border-border">
                <TeamSwitcher />
              </div>
              {MOBILE_OVERFLOW_NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors duration-150",
                      "hover:bg-accent/50",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
