/**
 * Pagination controls component — page navigation with ellipsis and page size selector.
 */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: PaginationProps) {
  const pageButtons = buildPageList(currentPage, totalPages);

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Showing {currentPage * pageSize + 1}-
          {Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems}
        </span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
          }}
          className="px-2 py-1 border rounded text-sm"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 items-center">
        <button
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
        >
          Previous
        </button>

        {pageButtons.map((page, idx) => {
          if (page === "ellipsis") {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-2 py-1 rounded text-sm min-w-[32px] ${
                currentPage === page
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {page + 1}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/**
 * Build the list of page indices (and "ellipsis" markers) to render.
 * Shows at most 7 page buttons plus ellipses.
 */
export function buildPageList(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  const maxVisible = 7;

  if (totalPages <= maxVisible) {
    for (let i = 0; i < totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Always show first page
  pages.push(0);

  // Calculate range around current page
  let start = Math.max(1, currentPage - 1);
  let end = Math.min(totalPages - 2, currentPage + 1);

  // Adjust range if near beginning or end
  if (currentPage <= 2) {
    end = Math.min(totalPages - 2, 3);
  } else if (currentPage >= totalPages - 3) {
    start = Math.max(1, totalPages - 4);
  }

  // Add left ellipsis if needed
  if (start > 1) {
    pages.push("ellipsis");
  }

  // Add middle pages
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Add right ellipsis if needed
  if (end < totalPages - 2) {
    pages.push("ellipsis");
  }

  // Always show last page
  pages.push(totalPages - 1);

  return pages;
}
