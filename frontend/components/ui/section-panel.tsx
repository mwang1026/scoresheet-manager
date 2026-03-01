interface SectionPanelProps {
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionPanel({
  title,
  badge,
  action,
  children,
  className,
}: SectionPanelProps) {
  return (
    <div
      className={`border border-border rounded-md overflow-hidden border-t-2 border-t-brand bg-card ${className ?? ""}`}
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card-elevated">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          {title}
          {badge && (
            <span className="font-mono text-xs text-muted-foreground">
              {badge}
            </span>
          )}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}
