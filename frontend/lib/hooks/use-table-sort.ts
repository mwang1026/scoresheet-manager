import { useState } from "react";

/**
 * Generic sort state hook for table components.
 *
 * @param initialColumn     The column to sort by initially.
 * @param initialDirection  The sort direction for the initial column.
 * @param newColumnDirection The default sort direction when switching to a new column.
 */
export function useTableSort<T extends string>(
  initialColumn: T,
  initialDirection: "asc" | "desc",
  newColumnDirection: "asc" | "desc"
): {
  sortColumn: T;
  sortDirection: "asc" | "desc";
  handleSort: (column: T) => void;
} {
  const [sortColumn, setSortColumn] = useState<T>(initialColumn);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialDirection);

  const handleSort = (column: T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(newColumnDirection);
    }
  };

  return { sortColumn, sortDirection, handleSort };
}
