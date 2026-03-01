"use client";

import Link from "next/link";
import { useLatestNews } from "@/lib/hooks/use-news-data";
import { SectionPanel } from "@/components/ui/section-panel";
import type { Player } from "@/lib/types";

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

interface RosterNewsWidgetProps {
  rosteredPlayerIds: Set<number>;
  playerMap: Map<number, Player>;
}

export function RosterNewsWidget({ rosteredPlayerIds, playerMap }: RosterNewsWidgetProps) {
  const { news, isLoading } = useLatestNews(50);

  // Filter to rostered players, take first 10
  const rosteredNews = news
    .filter((item) => item.player_id !== null && rosteredPlayerIds.has(item.player_id))
    .slice(0, 10);

  return (
    <SectionPanel
      title="Roster News"
      action={
        <Link
          href="/news?scope=my_players"
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
        >
          View All
        </Link>
      }
    >
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-4">
            <p className="text-base text-muted-foreground">Loading news...</p>
          </div>
        ) : rosteredNews.length === 0 ? (
          <div className="p-4">
            <p className="text-base text-muted-foreground">No recent news for your roster</p>
          </div>
        ) : (
          <div className="divide-y">
            {rosteredNews.map((item) => {
              const player = item.player_id !== null ? playerMap.get(item.player_id) : null;
              return (
                <div key={item.id} className="px-4 py-2.5 hover:bg-muted text-base">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      {player ? (
                        <Link
                          href={`/players/${player.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {player.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-muted-foreground">
                          {item.raw_player_name ?? "Unknown"}
                        </span>
                      )}
                    </div>
                    <div className="flex-none text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(item.published_at)}
                    </div>
                  </div>
                  <div className="mt-0.5 text-muted-foreground truncate">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {item.headline}
                    </a>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {item.source}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
