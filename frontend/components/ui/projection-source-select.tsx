"use client";

interface ProjectionSourceSelectProps {
  value: string;
  sources: string[];
  onChange: (source: string) => void;
}

export function ProjectionSourceSelect({ value, sources, onChange }: ProjectionSourceSelectProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium">Source:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1 border rounded text-sm"
      >
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
