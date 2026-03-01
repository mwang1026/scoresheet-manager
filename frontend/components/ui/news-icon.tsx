"use client";

import { Newspaper } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { TooltipOverlay } from "./tooltip-overlay";
import { usePlayerNews } from "@/lib/hooks/use-news-data";

export interface NewsIconProps {
  playerId: number;
  hasNews: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1d ago";
  return `${diffDays}d ago`;
}

export function NewsIcon({ playerId, hasNews }: NewsIconProps) {
  const router = useRouter();
  const [isHovering, setIsHovering] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  // Only fetch when hover triggers it (lazy on hover)
  const [shouldFetch, setShouldFetch] = useState(false);
  const { news, isLoading } = usePlayerNews(shouldFetch ? playerId : null, 5);

  // Show tooltip only when hovering AND data is ready (no loading flash)
  useEffect(() => {
    if (isHovering && shouldFetch && !isLoading) {
      setTooltipVisible(true);
    }
    if (!isHovering) {
      setTooltipVisible(false);
    }
  }, [isHovering, shouldFetch, isLoading]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsHovering(false);
      router.push(`/players/${playerId}`);
    },
    [playerId, router]
  );

  const handleMouseEnter = useCallback(() => {
    if (!hasNews) return;
    hoverTimeout.current = setTimeout(() => {
      setShouldFetch(true);
      setIsHovering(true);
    }, 200);
  }, [hasNews]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setIsHovering(false);
  }, []);

  if (!hasNews) return null;

  // Count items within last 7 days
  const recentCount = news.filter((item) => {
    const diffMs = Date.now() - new Date(item.published_at).getTime();
    return diffMs < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <>
      <span
        ref={iconRef}
        className="relative inline-flex items-center ml-1 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Newspaper
          className="w-3.5 h-3.5 text-brand"
          onClick={handleClick}
        />
      </span>

      {tooltipVisible && typeof document !== "undefined" &&
        createPortal(
          <TooltipOverlay iconRef={iconRef} onClick={handleClick}>
            {news.length > 0 ? (
              <div className="space-y-1">
                <div className="font-medium">{news[0].headline}</div>
                {news[0].body && (
                  <div className="text-muted-foreground line-clamp-2">
                    {news[0].body}
                  </div>
                )}
                <div className="text-muted-foreground">
                  {formatRelativeTime(news[0].published_at)} · {news[0].source}
                </div>
                {recentCount > 1 && (
                  <div className="text-muted-foreground">
                    +{recentCount - 1} more this week
                  </div>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">No recent news</span>
            )}
          </TooltipOverlay>,
          document.body
        )}
    </>
  );
}
