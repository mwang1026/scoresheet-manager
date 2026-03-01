import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows: number;
  columns: number;
  showHeader?: boolean;
}

export function TableSkeleton({ rows, columns, showHeader = true }: TableSkeletonProps) {
  return (
    <div className="border rounded overflow-hidden">
      <table className="w-full text-xs">
        {showHeader && (
          <thead className="bg-muted border-b-2 border-border">
            <tr>
              {Array.from({ length: columns }, (_, i) => (
                <th key={i} className="py-1.5 px-2">
                  <Skeleton className="h-3 w-12" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }, (_, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 1 ? "bg-muted" : ""}>
              {Array.from({ length: columns }, (_, colIdx) => (
                <td key={colIdx} className="py-1.5 px-2">
                  <Skeleton
                    className={`h-3 ${colIdx === 0 ? "w-24" : "w-10"}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
