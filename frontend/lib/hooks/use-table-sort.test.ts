import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSort } from "./use-table-sort";

describe("useTableSort", () => {
  it("initializes with the given column and direction", () => {
    const { result } = renderHook(() => useTableSort("OPS", "desc", "desc"));
    expect(result.current.sortColumn).toBe("OPS");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("toggles direction when sorting the same column (desc → asc)", () => {
    const { result } = renderHook(() => useTableSort("OPS", "desc", "desc"));
    act(() => result.current.handleSort("OPS"));
    expect(result.current.sortColumn).toBe("OPS");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("toggles direction when sorting the same column (asc → desc)", () => {
    const { result } = renderHook(() => useTableSort("ERA", "asc", "asc"));
    act(() => result.current.handleSort("ERA"));
    expect(result.current.sortColumn).toBe("ERA");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("switches to new column with newColumnDirection (desc)", () => {
    const { result } = renderHook(() => useTableSort<string>("OPS", "desc", "desc"));
    act(() => result.current.handleSort("AVG"));
    expect(result.current.sortColumn).toBe("AVG");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("switches to new column with newColumnDirection (asc)", () => {
    const { result } = renderHook(() => useTableSort<string>("ERA", "asc", "asc"));
    act(() => result.current.handleSort("WHIP"));
    expect(result.current.sortColumn).toBe("WHIP");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("subsequent same-column click toggles back", () => {
    const { result } = renderHook(() => useTableSort("OPS", "desc", "desc"));
    act(() => result.current.handleSort("OPS")); // → asc
    act(() => result.current.handleSort("OPS")); // → desc
    expect(result.current.sortDirection).toBe("desc");
  });
});
