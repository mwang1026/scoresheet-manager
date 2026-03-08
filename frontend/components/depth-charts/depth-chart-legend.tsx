"use client";

export function DepthChartLegend() {
  return (
    <div className="flex gap-3.5 flex-wrap items-center text-[10px] text-muted-foreground">
      {/* Role indicators */}
      <LegendBorderItem color="hsl(38, 59%, 56%)" label="vs Both" />
      <LegendBorderItem color="#3B82F6" label="vs LHP" />
      <LegendBorderItem color="#DC2626" label="vs RHP" />

      {/* Separator */}
      <div className="w-px h-3.5 bg-border" />

      {/* Depth indicators */}
      <LegendDotItem color="#22C55E" label="3+" />
      <LegendDotItem color="#F59E0B" label="2" />
      <LegendDotItem color="#EF4444" label="0-1" />
    </div>
  );
}

function LegendBorderItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-[3px] h-3 rounded-[1px] flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

function LegendDotItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}
