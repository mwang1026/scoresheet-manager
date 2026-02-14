import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftQueueTable } from "./draft-queue-table";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

describe("DraftQueueTable", () => {
  const mockHitter: Player = {
    id: 1,
    name: "Aaron Judge",
    current_team: "NYY",
    primary_position: "OF",
    defense: { OF: 9 },
    team_id: 1,
  };

  const mockPitcher: Player = {
    id: 2,
    name: "Gerrit Cole",
    current_team: "NYY",
    primary_position: "P",
    defense: {},
    team_id: 1,
  };

  const mockHitterStats: AggregatedHitterStats = {
    PA: 100,
    AB: 90,
    H: 27,
    "2B": 5,
    "3B": 1,
    HR: 6,
    R: 15,
    RBI: 18,
    BB: 8,
    K: 25,
    HBP: 1,
    SF: 1,
    SB: 2,
    CS: 0,
    AVG: 0.300,
    OBP: 0.370,
    SLG: 0.533,
    OPS: 0.903,
  };

  const mockPitcherStats: AggregatedPitcherStats = {
    G: 5,
    GS: 5,
    IP_outs: 90,
    W: 3,
    L: 1,
    K: 35,
    ER: 10,
    R: 12,
    H: 25,
    BB: 8,
    HBP: 2,
    SV: 0,
    BS: 0,
    HLD: 0,
    ERA: 3.00,
    WHIP: 1.10,
    K9: 10.50,
  };

  it("should render empty state when no players", () => {
    const onRemove = vi.fn();
    render(
      <DraftQueueTable
        players={[]}
        hitterStatsMap={new Map()}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Draft Queue (0)")).toBeInTheDocument();
    expect(screen.getByText("No players in your draft queue.")).toBeInTheDocument();
  });

  it("should render player count in heading", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Draft Queue (1)")).toBeInTheDocument();
  });

  it("should render player with position and OPS for hitters", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("OF")).toBeInTheDocument();
    expect(screen.getByText("0.903")).toBeInTheDocument();
  });

  it("should render player with position and ERA for pitchers", () => {
    const onRemove = vi.fn();
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <DraftQueueTable
        players={[mockPitcher]}
        hitterStatsMap={new Map()}
        pitcherStatsMap={pitcherStatsMap}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByText("3.00")).toBeInTheDocument();
  });

  it("should render queue position numbers", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <DraftQueueTable
        players={[mockHitter, mockPitcher]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });

  it("should link player names to detail page", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    const link = screen.getByRole("link", { name: "Aaron Judge" });
    expect(link).toHaveAttribute("href", "/players/1");
  });

  it("should call onRemove when remove button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("should not render remove buttons when not hydrated", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={false}
      />
    );
    expect(screen.queryByLabelText("Remove Aaron Judge from queue")).not.toBeInTheDocument();
  });
});
