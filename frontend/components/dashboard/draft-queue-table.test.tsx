import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraftQueueTable } from "./draft-queue-table";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

describe("DraftQueueTable", () => {
  const mockHitter: Player = {
    id: 1,
    name: "Aaron Judge",
    mlb_id: 592450,
    scoresheet_id: 1001,
    primary_position: "OF",
    hand: "R",
    age: 33,
    current_team: "NYY",
    team_id: 1,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: 9,
    osb_al: null,
    ocs_al: null,
    ba_vr: null,
    ob_vr: null,
    sl_vr: null,
    ba_vl: null,
    ob_vl: null,
    sl_vl: null,
    il_type: null,
    il_date: null,
  };

  const mockMultiPosHitter: Player = {
    id: 3,
    name: "Willy Adames",
    mlb_id: 642715,
    scoresheet_id: 1003,
    primary_position: "SS",
    hand: "R",
    age: 30,
    current_team: "SFG",
    team_id: null,
    eligible_1b: null,
    eligible_2b: 5,
    eligible_3b: null,
    eligible_ss: 8,
    eligible_of: null,
    osb_al: null,
    ocs_al: null,
    ba_vr: null,
    ob_vr: null,
    sl_vr: null,
    ba_vl: null,
    ob_vl: null,
    sl_vl: null,
    il_type: null,
    il_date: null,
  };

  const mockPitcher: Player = {
    id: 2,
    name: "Gerrit Cole",
    mlb_id: 543037,
    scoresheet_id: 1002,
    primary_position: "P",
    hand: "R",
    age: 35,
    current_team: "NYY",
    team_id: 1,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: null,
    osb_al: null,
    ocs_al: null,
    ba_vr: null,
    ob_vr: null,
    sl_vr: null,
    ba_vl: null,
    ob_vl: null,
    sl_vl: null,
    il_type: null,
    il_date: null,
  };

  const mockHitterStats: AggregatedHitterStats = {
    PA: 100,
    AB: 90,
    H: 27,
    "1B": 15,
    "2B": 5,
    "3B": 1,
    HR: 6,
    R: 15,
    RBI: 18,
    BB: 8,
    SO: 25,
    GO: 10,
    FO: 8,
    GDP: 2,
    IBB: 0,
    HBP: 1,
    SF: 1,
    SH: 0,
    SB: 2,
    CS: 0,
    AVG: 0.3,
    OBP: 0.37,
    SLG: 0.533,
    OPS: 0.903,
  };

  const mockPitcherStats: AggregatedPitcherStats = {
    G: 5,
    GS: 5,
    GF: 0,
    CG: 1,
    SHO: 0,
    IP_outs: 90,
    W: 3,
    L: 1,
    K: 35,
    ER: 10,
    R: 12,
    H: 25,
    BB: 8,
    IBB: 0,
    HBP: 2,
    SV: 0,
    HLD: 0,
    WP: 1,
    BK: 0,
    HR: 3,
    BF: 120,
    ERA: 3.0,
    WHIP: 1.1,
    K9: 10.5,
  };

  const defaultProps = {
    hitterStatsMap: new Map<number, AggregatedHitterStats>(),
    pitcherStatsMap: new Map<number, AggregatedPitcherStats>(),
    getNote: vi.fn(() => ""),
    saveNote: vi.fn(),
  };

  it("should render empty state when no players", () => {
    render(<DraftQueueTable {...defaultProps} players={[]} />);

    expect(screen.getByText("Draft Queue")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("No players in your draft queue.")).toBeInTheDocument();
  });

  it("should render player count in heading", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getByText("Draft Queue")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should render player with position and OPS for hitters", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    // Position and stat appear in both wide and narrow responsive variants
    expect(screen.getAllByText("OF")).toHaveLength(2);
    expect(screen.getAllByText("0.903")).toHaveLength(2);
  });

  it("should render player with position and ERA for pitchers", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockPitcher]}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    expect(screen.getAllByText("P")).toHaveLength(2);
    expect(screen.getAllByText("3.00")).toHaveLength(2);
  });

  it("should render queue position numbers", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter, mockPitcher]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });

  it("should link player names to detail page", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    const link = screen.getByRole("link", { name: "Aaron Judge" });
    expect(link).toHaveAttribute("href", "/players/1");
  });

  it("should display OPS label for hitters", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    // Label appears in both wide and narrow responsive variants
    expect(screen.getAllByText("OPS")).toHaveLength(2);
  });

  it("should display ERA label for pitchers", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockPitcher]}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getAllByText("ERA")).toHaveLength(2);
  });

  it("should display both OPS and ERA labels in mixed queue", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter, mockPitcher]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getAllByText("OPS")).toHaveLength(2);
    expect(screen.getAllByText("ERA")).toHaveLength(2);
  });

  it("should show comma-separated positions for multi-position player", () => {
    const hitterStatsMap = new Map([[mockMultiPosHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockMultiPosHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getAllByText("SS, 2B")).toHaveLength(2);
  });

  it("should show single position for single-position player", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getAllByText("OF")).toHaveLength(2);
  });

  it("should render Manage Draft Queue button in header", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    const manageLink = screen.getByRole("link", { name: "Manage Draft Queue" });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute("href", "/draft");
  });

  it("should render Manage Draft Queue button in empty state", () => {
    render(<DraftQueueTable {...defaultProps} players={[]} />);

    const manageLink = screen.getByRole("link", { name: "Manage Draft Queue" });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute("href", "/draft");
  });

  it("should not render drag handles", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.queryByLabelText("Reorder Aaron Judge")).not.toBeInTheDocument();
  });

  it("should not render remove controls", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(
      screen.queryByLabelText("Remove Aaron Judge from queue")
    ).not.toBeInTheDocument();
  });

  it("should render IL icon when player has il_type", () => {
    const ilPlayer: Player = { ...mockHitter, id: 99, name: "IL Guy", il_type: "10-Day IL", il_date: "2026-02-14" };
    const hitterStatsMap = new Map([[ilPlayer.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[ilPlayer]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    // ILIcon renders a Cross SVG with text-destructive
    const svgs = document.querySelectorAll("svg.text-destructive");
    expect(svgs.length).toBe(1);
  });
});
