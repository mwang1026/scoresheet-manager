"use client";

/**
 * Shared header / body / total cells for the playoff column set.
 *
 * In playoff mode the compact roster tables swap their counting-stat columns
 * (R, RBI, HR, SB for hitters; G, GS, K, BB, ER, R for pitchers) for the
 * playing-time meta Scoresheet actually enforces in a series. Rates stay.
 */

import type { PlayoffHitterMeta, PlayoffPitcherMeta } from "@/lib/stats/playoff";
import { formatIP } from "@/lib/stats/aggregation";
import type { PlayoffHitterSortColumn, PlayoffPitcherSortColumn } from "@/lib/sort-columns";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { Dash } from "@/components/ui/stat-placeholder";

export type TableColumnSet = "default" | "playoff";

const TD_NUM = "py-1.5 px-2 text-right font-mono tabular-nums";
const WINDOW_TITLE = "Inside the playoff stats window (final four weeks of the regular season)";
const SERIES_TITLE = "Available per playoff series";

/** Muted row styling for players who will not play in the playoffs. */
export function playoffRowClass(meta: { willPlay: boolean } | undefined): string {
  return meta && !meta.willPlay ? "opacity-50" : "";
}

export function playoffHitterSortValue(
  meta: PlayoffHitterMeta | undefined,
  column: PlayoffHitterSortColumn
): number | null {
  return meta ? meta[column] : null;
}

export function playoffPitcherSortValue(
  meta: PlayoffPitcherMeta | undefined,
  column: PlayoffPitcherSortColumn
): number | null {
  return meta ? meta[column] : null;
}

interface HeaderProps<C extends string> {
  thStat: string;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: C) => void;
}

export function PlayoffHitterHeaderCells({ thStat, sortColumn, sortDirection, onSort }: HeaderProps<PlayoffHitterSortColumn>) {
  return (
    <>
      <th className={thStat} title={WINDOW_TITLE} onClick={() => onSort("windowPA")}>
        Sep PA <SortIndicator active={sortColumn === "windowPA"} direction={sortDirection} />
      </th>
      <th className={thStat} title={SERIES_TITLE} onClick={() => onSort("seriesPACap")}>
        Ser PA <SortIndicator active={sortColumn === "seriesPACap"} direction={sortDirection} />
      </th>
      <th className={`${thStat.replace("cursor-pointer select-none", "")} text-center`}>Elig</th>
    </>
  );
}

export function PlayoffHitterCells({ meta }: { meta: PlayoffHitterMeta | undefined }) {
  if (!meta) {
    return (
      <>
        <td className={TD_NUM}><Dash /></td>
        <td className={TD_NUM}><Dash /></td>
        <td className={`${TD_NUM} text-center`}><Dash /></td>
      </>
    );
  }
  return (
    <>
      <td className={TD_NUM}>{meta.windowPA}</td>
      <td className={TD_NUM}>{meta.seriesPACap}</td>
      <td className={`${TD_NUM} text-center`}>
        <EligibilityBadge willPlay={meta.willPlay} />
      </td>
    </>
  );
}

export function PlayoffHitterTotalCells({ metas }: { metas: PlayoffHitterMeta[] }) {
  const windowPA = metas.reduce((sum, m) => sum + m.windowPA, 0);
  const seriesPACap = metas.reduce((sum, m) => sum + m.seriesPACap, 0);
  return (
    <>
      <td className={TD_NUM}>{windowPA}</td>
      <td className={TD_NUM}>{seriesPACap}</td>
      <td className={TD_NUM} />
    </>
  );
}

export function PlayoffPitcherHeaderCells({ thStat, sortColumn, sortDirection, onSort }: HeaderProps<PlayoffPitcherSortColumn>) {
  return (
    <>
      <th className={thStat} title={WINDOW_TITLE} onClick={() => onSort("windowIPOuts")}>
        Sep IP <SortIndicator active={sortColumn === "windowIPOuts"} direction={sortDirection} />
      </th>
      <th className={thStat} title={SERIES_TITLE} onClick={() => onSort("seriesIPOutsCap")}>
        Ser IP <SortIndicator active={sortColumn === "seriesIPOutsCap"} direction={sortDirection} />
      </th>
      <th className={thStat} title="Playoff starts allowed per series (needs 1 / 3 MLB starts in the window)" onClick={() => onSort("playoffStarts")}>
        Starts <SortIndicator active={sortColumn === "playoffStarts"} direction={sortDirection} />
      </th>
      <th className={`${thStat.replace("cursor-pointer select-none", "")} text-center`}>Elig</th>
    </>
  );
}

export function PlayoffPitcherCells({ meta }: { meta: PlayoffPitcherMeta | undefined }) {
  if (!meta) {
    return (
      <>
        <td className={TD_NUM}><Dash /></td>
        <td className={TD_NUM}><Dash /></td>
        <td className={TD_NUM}><Dash /></td>
        <td className={`${TD_NUM} text-center`}><Dash /></td>
      </>
    );
  }
  return (
    <>
      <td className={TD_NUM}>{formatIP(meta.windowIPOuts)}</td>
      <td className={TD_NUM}>{formatIP(meta.seriesIPOutsCap)}</td>
      <td className={TD_NUM}>{meta.playoffStarts}</td>
      <td className={`${TD_NUM} text-center`}>
        <EligibilityBadge willPlay={meta.willPlay} />
      </td>
    </>
  );
}

export function PlayoffPitcherTotalCells({ metas }: { metas: PlayoffPitcherMeta[] }) {
  const windowIPOuts = metas.reduce((sum, m) => sum + m.windowIPOuts, 0);
  const seriesIPOutsCap = metas.reduce((sum, m) => sum + m.seriesIPOutsCap, 0);
  const starts = metas.reduce((sum, m) => sum + m.playoffStarts, 0);
  return (
    <>
      <td className={TD_NUM}>{formatIP(windowIPOuts)}</td>
      <td className={TD_NUM}>{formatIP(seriesIPOutsCap)}</td>
      <td className={TD_NUM}>{starts}</td>
      <td className={TD_NUM} />
    </>
  );
}

function EligibilityBadge({ willPlay }: { willPlay: boolean }) {
  return willPlay ? (
    <span className="text-muted-foreground" aria-label="eligible">✓</span>
  ) : (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-destructive/15 text-destructive"
      title="No MLB playing time in the playoff window: will not play"
    >
      OUT
    </span>
  );
}
