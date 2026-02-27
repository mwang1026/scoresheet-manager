"use client";

import { useState } from "react";
import { usePlayerNews } from "@/lib/hooks/use-news-data";
import { Pagination } from "@/components/ui/pagination";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PlayerNewsSectionProps {
  playerId: number;
}

export function PlayerNewsSection({ playerId }: PlayerNewsSectionProps) {
  const { news, isLoading } = usePlayerNews(playerId, 100);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 5;

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">News</h2>
        <p className="text-sm text-muted-foreground">Loading news...</p>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">News</h2>
        <p className="text-sm text-muted-foreground">No news for this player</p>
      </div>
    );
  }

  const totalPages = Math.ceil(news.length / pageSize);
  const paginatedNews = news.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">News</h2>
      <div className="space-y-3">
        {paginatedNews.map((item) => (
          <div key={item.id} className="border rounded p-3">
            <div className="flex items-baseline justify-between gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {item.headline}
              </a>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(item.published_at)}
              </span>
            </div>
            {item.body && (
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {item.source}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={news.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={() => {}}
          pageSizeOptions={[5]}
        />
      )}
    </div>
  );
}
