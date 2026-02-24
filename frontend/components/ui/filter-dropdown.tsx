"use client";

import { useState, useEffect, useRef } from "react";

interface FilterDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export function FilterDropdown({ label, options, selected, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleOption = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  };

  const selectAll = () => {
    onChange(new Set(options.map((o) => o.value)));
  };

  const clearAll = () => {
    onChange(new Set());
  };

  const badgeCount = selected.size;
  const buttonLabel = badgeCount > 0 ? `${label} (${badgeCount})` : label;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="px-3 py-1 rounded text-sm bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1"
      >
        {buttonLabel}
        <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border rounded shadow-md min-w-[120px] py-1">
          <div className="flex gap-2 px-2 py-1 border-b text-xs">
            <button onClick={selectAll} className="text-primary hover:underline">
              All
            </button>
            <button onClick={clearAll} className="text-primary hover:underline">
              Clear
            </button>
          </div>
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2 py-1 hover:bg-muted cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggleOption(opt.value)}
                className="cursor-pointer"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
