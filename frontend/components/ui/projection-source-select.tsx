"use client";

import { FormSelect } from "@/components/ui/form-select";

interface ProjectionSourceSelectProps {
  value: string;
  sources: string[];
  onChange: (source: string) => void;
}

export function ProjectionSourceSelect({ value, sources, onChange }: ProjectionSourceSelectProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium">Source:</span>
      <FormSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </FormSelect>
    </div>
  );
}
