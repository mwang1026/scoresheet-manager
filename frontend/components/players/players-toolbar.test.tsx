import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayersToolbar } from "./players-toolbar";
import type { PlayersToolbarProps } from "./players-toolbar";

function makeProps(overrides: Partial<PlayersToolbarProps> = {}): PlayersToolbarProps {
  return {
    activeTab: "hitters",
    defaultHitterSortColumn: "OPS",
    defaultHitterSortDirection: "desc",
    defaultPitcherSortColumn: "ERA",
    defaultPitcherSortDirection: "asc",
    onTabChange: vi.fn(),
    selectedPositions: new Set(),
    onPositionsChange: vi.fn(),
    selectedHands: new Set(),
    onHandsChange: vi.fn(),
    statusFilter: "all",
    onStatusFilterChange: vi.fn(),
    statsSource: "actual",
    onStatsSourceChange: vi.fn(),
    dateRange: { type: "season", year: 2026 },
    onDateRangeChange: vi.fn(),
    seasonYear: 2026,
    minPA: "qualified",
    onMinPAChange: vi.fn(),
    minIP: "qualified",
    onMinIPChange: vi.fn(),
    projectionSource: "PECOTA-50",
    availableSources: ["PECOTA-50", "Steamer"],
    onProjectionSourceChange: vi.fn(),
    searchQuery: "",
    onSearchChange: vi.fn(),
    onResetPage: vi.fn(),
    ...overrides,
  };
}

// Helper: get the desktop version of duplicated elements (mobile + desktop render both in DOM)
function getDesktop(elements: HTMLElement[]) {
  // Desktop elements have parent with "hidden md:flex" class; mobile have "md:hidden"
  // In jsdom neither is actually hidden, so just return the last one (desktop comes after mobile)
  return elements[elements.length - 1];
}

describe("PlayersToolbar tab switching", () => {
  it("renders Hitters and Pitchers tab buttons", () => {
    render(<PlayersToolbar {...makeProps()} />);
    expect(screen.getAllByText("Hitters").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pitchers").length).toBeGreaterThanOrEqual(1);
  });

  it("highlights the active tab", () => {
    render(<PlayersToolbar {...makeProps({ activeTab: "hitters" })} />);
    const hitterBtns = screen.getAllByText("Hitters");
    // At least one should be highlighted
    expect(hitterBtns.some((btn) => btn.className.includes("bg-brand/15"))).toBe(true);
  });

  it("clicking Pitchers calls onTabChange with pitcher defaults", () => {
    const onTabChange = vi.fn();
    render(<PlayersToolbar {...makeProps({ onTabChange })} />);
    // Click the desktop Pitchers button
    fireEvent.click(getDesktop(screen.getAllByText("Pitchers")));
    expect(onTabChange).toHaveBeenCalledWith("pitchers", "ERA", "asc");
  });

  it("clicking Hitters calls onTabChange with hitter defaults", () => {
    const onTabChange = vi.fn();
    render(<PlayersToolbar {...makeProps({ activeTab: "pitchers", onTabChange })} />);
    fireEvent.click(getDesktop(screen.getAllByText("Hitters")));
    expect(onTabChange).toHaveBeenCalledWith("hitters", "OPS", "desc");
  });

  it("clicking a tab also calls onResetPage", () => {
    const onResetPage = vi.fn();
    render(<PlayersToolbar {...makeProps({ onResetPage })} />);
    fireEvent.click(getDesktop(screen.getAllByText("Pitchers")));
    expect(onResetPage).toHaveBeenCalled();
  });
});

describe("PlayersToolbar status filters", () => {
  it("renders all status filter buttons", () => {
    render(<PlayersToolbar {...makeProps()} />);
    // Mobile filter panel is collapsed by default, so only desktop instances are in DOM
    expect(screen.getByText("Watchlisted")).toBeDefined();
    expect(screen.getByText("In Queue")).toBeDefined();
    expect(screen.getByText("Unowned")).toBeDefined();
  });

  it("highlights the active status filter", () => {
    render(<PlayersToolbar {...makeProps({ statusFilter: "watchlisted" })} />);
    const btn = screen.getByText("Watchlisted");
    expect(btn.className).toContain("bg-brand/15");
  });

  it("clicking a status filter calls onStatusFilterChange", () => {
    const onStatusFilterChange = vi.fn();
    render(<PlayersToolbar {...makeProps({ onStatusFilterChange })} />);
    fireEvent.click(screen.getByText("Unowned"));
    expect(onStatusFilterChange).toHaveBeenCalledWith("unowned");
  });

  it("clicking a status filter also calls onResetPage", () => {
    const onResetPage = vi.fn();
    render(<PlayersToolbar {...makeProps({ onResetPage })} />);
    fireEvent.click(screen.getByText("Watchlisted"));
    expect(onResetPage).toHaveBeenCalled();
  });
});

describe("PlayersToolbar stats source", () => {
  it("renders Actual and Projected buttons", () => {
    render(<PlayersToolbar {...makeProps()} />);
    expect(screen.getByText("Actual")).toBeDefined();
    expect(screen.getByText("Projected")).toBeDefined();
  });

  it("clicking Projected calls onStatsSourceChange", () => {
    const onStatsSourceChange = vi.fn();
    render(<PlayersToolbar {...makeProps({ onStatsSourceChange })} />);
    fireEvent.click(screen.getByText("Projected"));
    expect(onStatsSourceChange).toHaveBeenCalledWith("projected");
  });

  it("shows date range select when statsSource is actual", () => {
    render(<PlayersToolbar {...makeProps({ statsSource: "actual" })} />);
    expect(screen.getByText("Date Range:")).toBeDefined();
  });

  it("hides date range select when statsSource is projected", () => {
    render(<PlayersToolbar {...makeProps({ statsSource: "projected" })} />);
    expect(screen.queryByText("Date Range:")).toBeNull();
  });

  it("shows projection source select when statsSource is projected", () => {
    render(<PlayersToolbar {...makeProps({ statsSource: "projected" })} />);
    expect(screen.getByText("Source:")).toBeDefined();
  });

  it("hides projection source select when statsSource is actual", () => {
    render(<PlayersToolbar {...makeProps({ statsSource: "actual" })} />);
    expect(screen.queryByText("Source:")).toBeNull();
  });
});

describe("PlayersToolbar date range", () => {
  it("calls onDateRangeChange with DateRange object when date range select changes", () => {
    const onDateRangeChange = vi.fn();
    render(<PlayersToolbar {...makeProps({ onDateRangeChange })} />);
    const select = screen.getByDisplayValue("Season to Date");
    fireEvent.change(select, { target: { value: "last7" } });
    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "last7" });
  });

  it("shows custom date inputs when dateRange type is custom", () => {
    render(
      <PlayersToolbar
        {...makeProps({
          dateRange: { type: "custom", start: "2026-05-01", end: "2026-05-31" },
        })}
      />
    );
    expect(screen.getByDisplayValue("2026-05-01")).toBeDefined();
    expect(screen.getByDisplayValue("2026-05-31")).toBeDefined();
  });

  it("does not show custom date inputs when dateRange type is season", () => {
    render(<PlayersToolbar {...makeProps({ dateRange: { type: "season", year: 2026 } })} />);
    expect(screen.queryByDisplayValue("2026-01-01")).toBeNull();
  });

  it("shows Min PA label for hitters", () => {
    render(<PlayersToolbar {...makeProps({ activeTab: "hitters" })} />);
    expect(screen.getByText("Min PA:")).toBeDefined();
  });

  it("shows Min IP label for pitchers", () => {
    render(<PlayersToolbar {...makeProps({ activeTab: "pitchers" })} />);
    expect(screen.getByText("Min IP:")).toBeDefined();
  });
});

describe("PlayersToolbar search", () => {
  it("renders search input", () => {
    render(<PlayersToolbar {...makeProps()} />);
    expect(screen.getAllByPlaceholderText("Search players...").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSearchChange when typing in search box", () => {
    const onSearchChange = vi.fn();
    render(<PlayersToolbar {...makeProps({ onSearchChange })} />);
    const inputs = screen.getAllByPlaceholderText("Search players...");
    fireEvent.change(inputs[inputs.length - 1], { target: { value: "Judge" } });
    expect(onSearchChange).toHaveBeenCalledWith("Judge");
  });

  it("calls onResetPage when typing in search box", () => {
    const onResetPage = vi.fn();
    render(<PlayersToolbar {...makeProps({ onResetPage })} />);
    const inputs = screen.getAllByPlaceholderText("Search players...");
    fireEvent.change(inputs[inputs.length - 1], { target: { value: "x" } });
    expect(onResetPage).toHaveBeenCalled();
  });

  it("reflects current searchQuery value", () => {
    render(<PlayersToolbar {...makeProps({ searchQuery: "Trout" })} />);
    const inputs = screen.getAllByPlaceholderText("Search players...") as HTMLInputElement[];
    expect(inputs.some((input) => input.value === "Trout")).toBe(true);
  });
});

describe("PlayersToolbar projection source", () => {
  it("renders available projection sources in select", () => {
    render(
      <PlayersToolbar
        {...makeProps({
          statsSource: "projected",
          availableSources: ["PECOTA-50", "Steamer", "ZiPS"],
        })}
      />
    );
    expect(screen.getAllByText("PECOTA-50").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Steamer").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ZiPS").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onProjectionSourceChange when selecting a source", () => {
    const onProjectionSourceChange = vi.fn();
    render(
      <PlayersToolbar
        {...makeProps({
          statsSource: "projected",
          onProjectionSourceChange,
          availableSources: ["PECOTA-50", "Steamer"],
        })}
      />
    );
    const selects = screen.getAllByDisplayValue("PECOTA-50");
    fireEvent.change(selects[selects.length - 1], { target: { value: "Steamer" } });
    expect(onProjectionSourceChange).toHaveBeenCalledWith("Steamer");
  });
});
