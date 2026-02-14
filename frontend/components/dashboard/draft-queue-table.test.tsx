import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftQueueTable } from "./draft-queue-table";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

// Mock @dnd-kit modules
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: vi.fn((arr, from, to) => {
    const newArr = [...arr];
    const [item] = newArr.splice(from, 1);
    newArr.splice(to, 0, item);
    return newArr;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ""),
    },
  },
}));

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
    hitterStatsMap: new Map(),
    pitcherStatsMap: new Map(),
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    isHydrated: true,
  };

  it("should render empty state when no players", () => {
    render(<DraftQueueTable {...defaultProps} players={[]} />);

    expect(screen.getByText("Draft Queue (0)")).toBeInTheDocument();
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

    expect(screen.getByText("Draft Queue (1)")).toBeInTheDocument();
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
    expect(screen.getByText("OF")).toBeInTheDocument();
    expect(screen.getByText("0.903")).toBeInTheDocument();
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
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByText("3.00")).toBeInTheDocument();
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

  it("should render drag handles for reordering", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    const dragHandle = screen.getByLabelText("Reorder Aaron Judge");
    expect(dragHandle).toBeInTheDocument();
  });

  it("should open confirm dialog when remove button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
      />
    );

    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);

    // Should show confirmation dialog
    expect(
      screen.getByText("Remove Aaron Judge from draft queue?")
    ).toBeInTheDocument();
  });

  it("should show checkbox to also remove from watchlist in confirm dialog", async () => {
    const user = userEvent.setup();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);

    expect(screen.getByText("Also remove from watchlist")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("should call onRemove when confirm button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
      />
    );

    // Click remove button to open dialog
    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);

    // Click confirm button
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("should call both onRemove and onRemoveFromWatchlist when checkbox is checked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onRemoveFromWatchlist = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
        onRemoveFromWatchlist={onRemoveFromWatchlist}
      />
    );

    // Click remove button to open dialog
    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);

    // Check the checkbox
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    // Click confirm button
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith(1);
    expect(onRemoveFromWatchlist).toHaveBeenCalledWith(1);
  });

  it("should not call onRemoveFromWatchlist when checkbox is not checked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onRemoveFromWatchlist = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
        onRemoveFromWatchlist={onRemoveFromWatchlist}
      />
    );

    // Click remove button to open dialog
    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);

    // Do NOT check the checkbox

    // Click confirm button
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith(1);
    expect(onRemoveFromWatchlist).not.toHaveBeenCalled();
  });

  it("should not call onRemove when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
      />
    );

    // Click remove button to open dialog
    const removeButton = screen.getByLabelText("Remove Aaron Judge from queue");
    await user.click(removeButton);

    // Click cancel button
    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("should not render drag handles and remove buttons when not hydrated", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <DraftQueueTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        isHydrated={false}
      />
    );

    expect(
      screen.queryByLabelText("Remove Aaron Judge from queue")
    ).not.toBeInTheDocument();
  });
});
