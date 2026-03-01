import { formatAvg, formatRate, formatIP } from "@/lib/stats";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface TeamStatsSummaryProps {
  hitterStats: AggregatedHitterStats;
  pitcherStats: AggregatedPitcherStats;
}

export function TeamStatsSummary({ hitterStats, pitcherStats }: TeamStatsSummaryProps) {
  return (
    <div className="border rounded-lg">
      <div className="p-4 bg-brand text-white rounded-t-lg">
        <h2 className="text-lg font-semibold">Team Stats Summary</h2>
      </div>
      <div className="p-4">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Hitting Stats */}
        <div className="flex-1">
          <h3 className="text-xs text-muted-foreground uppercase mb-3">Hitting</h3>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase">AVG</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatAvg(hitterStats.AVG)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">OBP</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatAvg(hitterStats.OBP)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">OPS</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatAvg(hitterStats.OPS)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">HR</div>
              <div className="text-lg font-semibold font-mono tabular-nums">{hitterStats.HR}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">SB</div>
              <div className="text-lg font-semibold font-mono tabular-nums">{hitterStats.SB}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">R</div>
              <div className="text-lg font-semibold font-mono tabular-nums">{hitterStats.R}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">RBI</div>
              <div className="text-lg font-semibold font-mono tabular-nums">{hitterStats.RBI}</div>
            </div>
          </div>
        </div>

        {/* Pitching Stats */}
        <div className="flex-1 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6">
          <h3 className="text-xs text-muted-foreground uppercase mb-3">Pitching</h3>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase">ERA</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatRate(pitcherStats.ERA)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">WHIP</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatRate(pitcherStats.WHIP)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">K/9</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatRate(pitcherStats.K9)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">IP</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {formatIP(pitcherStats.IP_outs)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">W-L</div>
              <div className="text-lg font-semibold font-mono tabular-nums">
                {pitcherStats.W}-{pitcherStats.L}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">SV</div>
              <div className="text-lg font-semibold font-mono tabular-nums">{pitcherStats.SV}</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
