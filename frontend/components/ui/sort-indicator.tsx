import { ChevronUp, ChevronDown } from "lucide-react";

interface SortIndicatorProps {
  active: boolean;
  direction: "asc" | "desc";
}

export function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) return null;
  return direction === "asc" ? (
    <ChevronUp className="inline w-3 h-3" />
  ) : (
    <ChevronDown className="inline w-3 h-3" />
  );
}
