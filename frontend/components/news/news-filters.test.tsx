import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewsFilters } from "./news-filters";

describe("NewsFilters", () => {
  const defaultProps = {
    scope: "my_players" as const,
    onScopeChange: vi.fn(),
    selectedPositions: new Set<string>(),
    onPositionsChange: vi.fn(),
    selectedTeams: new Set<string>(),
    onTeamsChange: vi.fn(),
    availableTeams: [
      { value: "NYY", label: "NYY" },
      { value: "LAD", label: "LAD" },
    ],
    dateRange: "7" as const,
    onDateRangeChange: vi.fn(),
    onReset: vi.fn(),
    hasActiveFilters: false,
  };

  it("renders scope select with default value", () => {
    render(<NewsFilters {...defaultProps} />);
    const select = screen.getByDisplayValue("My Players");
    expect(select).toBeInTheDocument();
  });

  it("renders date range select", () => {
    render(<NewsFilters {...defaultProps} />);
    expect(screen.getByDisplayValue("Last 7 days")).toBeInTheDocument();
  });

  it("calls onScopeChange when scope changes", () => {
    render(<NewsFilters {...defaultProps} />);
    const select = screen.getByDisplayValue("My Players");
    fireEvent.change(select, { target: { value: "all" } });
    expect(defaultProps.onScopeChange).toHaveBeenCalledWith("all");
  });

  it("shows reset link when filters are active", () => {
    render(<NewsFilters {...defaultProps} hasActiveFilters={true} />);
    expect(screen.getByText("Reset Filters")).toBeInTheDocument();
  });

  it("hides reset link when no active filters", () => {
    render(<NewsFilters {...defaultProps} hasActiveFilters={false} />);
    expect(screen.queryByText("Reset Filters")).not.toBeInTheDocument();
  });

  it("calls onReset when reset is clicked", () => {
    render(<NewsFilters {...defaultProps} hasActiveFilters={true} />);
    fireEvent.click(screen.getByText("Reset Filters"));
    expect(defaultProps.onReset).toHaveBeenCalled();
  });
});
