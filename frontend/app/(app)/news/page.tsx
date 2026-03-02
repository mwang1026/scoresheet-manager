"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLatestNews } from "@/lib/hooks/use-news-data";
import { usePlayers } from "@/lib/hooks/use-players-data";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import { useTeamContext } from "@/lib/contexts/team-context";
import { isEligibleAt } from "@/lib/stats";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  NewsFilters,
  type NewsScope,
  type NewsDateRange,
} from "@/components/news/news-filters";
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NewsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentTeam } = useTeamContext();

  // URL-synced state
  const initialScope = (searchParams.get("scope") as NewsScope) || "my_players";
  const [scope, setScope] = useState<NewsScope>(initialScope);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<NewsDateRange>("7");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Fetch all news (filter client-side)
  const { news, isLoading: newsLoading, error: newsError } = useLatestNews(1000);
  const { players, isLoading: playersLoading } = usePlayers();
  const { watchlist, queue } = usePlayerLists();

  // Build player lookup and team options
  const { playerMap, availableTeams, rosteredIds } = useMemo(() => {
    const playersList = players || [];
    const playerMap = new Map<number, Player>(playersList.map((p) => [p.id, p]));

    // Unique MLB teams from players
    const teamSet = new Set(playersList.map((p) => p.current_team).filter(Boolean));
    const availableTeams = Array.from(teamSet)
      .sort()
      .map((t) => ({ value: t, label: t }));

    const rosteredIds = new Set(
      playersList.filter((p) => p.team_id === currentTeam?.id).map((p) => p.id)
    );

    return { playerMap, availableTeams, rosteredIds };
  }, [players, currentTeam]);

  // Apply all filters client-side
  const filteredNews = useMemo(() => {
    let result = news;

    // Scope filter
    if (scope === "my_players") {
      result = result.filter((item) => item.player_id !== null && rosteredIds.has(item.player_id));
    } else if (scope === "watchlist") {
      result = result.filter((item) => item.player_id !== null && watchlist.has(item.player_id));
    } else if (scope === "queue") {
      const queueSet = new Set(queue);
      result = result.filter((item) => item.player_id !== null && queueSet.has(item.player_id));
    } else if (scope === "all") {
      result = result.filter((item) => item.player_id !== null && playerMap.has(item.player_id));
    }

    // Position filter
    if (selectedPositions.size > 0) {
      result = result.filter((item) => {
        if (item.player_id === null) return false;
        const player = playerMap.get(item.player_id);
        if (!player) return false;
        return Array.from(selectedPositions).some((pos) => isEligibleAt(player, pos));
      });
    }

    // Team filter
    if (selectedTeams.size > 0) {
      result = result.filter((item) => {
        if (item.player_id === null) return false;
        const player = playerMap.get(item.player_id);
        if (!player) return false;
        return selectedTeams.has(player.current_team);
      });
    }

    // Date range filter
    if (dateRange !== "all") {
      const days = Number(dateRange);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      result = result.filter((item) => new Date(item.published_at).getTime() >= cutoff);
    }

    return result;
  }, [news, scope, selectedPositions, selectedTeams, dateRange, rosteredIds, watchlist, queue, playerMap]);

  // Paginate
  const totalPages = Math.ceil(filteredNews.length / pageSize);
  const paginatedNews = filteredNews.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  // URL sync for scope changes
  const handleScopeChange = (newScope: NewsScope) => {
    setScope(newScope);
    setCurrentPage(0);
    const params = new URLSearchParams(searchParams);
    if (newScope === "my_players") {
      params.delete("scope");
    } else {
      params.set("scope", newScope);
    }
    router.replace(`/news?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters =
    scope !== "my_players" ||
    selectedPositions.size > 0 ||
    selectedTeams.size > 0 ||
    dateRange !== "7";

  const handleReset = () => {
    setScope("my_players");
    setSelectedPositions(new Set());
    setSelectedTeams(new Set());
    setDateRange("7");
    setCurrentPage(0);
    router.replace("/news", { scroll: false });
  };

  const isLoading = newsLoading || playersLoading;

  if (newsError) {
    return (
      <div className="px-3 py-6 sm:px-6 lg:px-8">
        <p className="text-destructive">Error loading news: {newsError.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-6">
        <TableSkeleton rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-6">
      <PageHeader title="News" />

      <NewsFilters
        scope={scope}
        onScopeChange={handleScopeChange}
        selectedPositions={selectedPositions}
        onPositionsChange={(p) => { setSelectedPositions(p); setCurrentPage(0); }}
        selectedTeams={selectedTeams}
        onTeamsChange={(t) => { setSelectedTeams(t); setCurrentPage(0); }}
        availableTeams={availableTeams}
        dateRange={dateRange}
        onDateRangeChange={(d) => { setDateRange(d); setCurrentPage(0); }}
        onReset={handleReset}
        hasActiveFilters={hasActiveFilters}
      />

      {filteredNews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No news matches your filters</p>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b-2 border-border">
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold">Player</th>
                  <th className="py-1.5 px-2 text-left font-semibold hidden sm:table-cell">Date</th>
                  <th className="py-1.5 px-2 text-left font-semibold">Headline</th>
                  <th className="py-1.5 px-2 text-left font-semibold hidden sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {paginatedNews.map((item) => {
                  const player = item.player_id !== null ? playerMap.get(item.player_id) : null;
                  return (
                    <tr key={item.id} className="even:bg-muted hover:bg-row-hover transition-colors duration-100 border-b last:border-b-0">
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        {player ? (
                          <div>
                            <Link
                              href={`/players/${player.id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {player.name}
                            </Link>
                            <div className="text-sm text-muted-foreground">
                              {player.current_team} · {player.primary_position}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {item.raw_player_name ?? "Unknown"}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-muted-foreground hidden sm:table-cell">
                        <div>{formatRelativeTime(item.published_at)}</div>
                        <div className="text-sm">{formatDate(item.published_at)}</div>
                      </td>
                      <td className="py-1.5 px-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {item.headline}
                        </a>
                        <span className="sm:hidden text-xs text-muted-foreground ml-2">
                          {formatRelativeTime(item.published_at)}
                        </span>
                        {item.body && (
                          <p className="mt-1 text-muted-foreground">{item.body}</p>
                        )}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-sm text-muted-foreground hidden sm:table-cell">
                        {item.source}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredNews.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(0);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
      <NewsPageContent />
    </Suspense>
  );
}
