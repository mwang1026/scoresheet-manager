import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TableSkeleton } from "./table-skeleton";

describe("TableSkeleton", () => {
  it("renders the correct number of rows and columns", () => {
    const { container } = render(<TableSkeleton rows={5} columns={3} />);
    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(5);
    const firstRowCells = bodyRows[0].querySelectorAll("td");
    expect(firstRowCells).toHaveLength(3);
  });

  it("renders a header row by default", () => {
    const { container } = render(<TableSkeleton rows={2} columns={4} />);
    const headerCells = container.querySelectorAll("thead th");
    expect(headerCells).toHaveLength(4);
  });

  it("hides header when showHeader is false", () => {
    const { container } = render(<TableSkeleton rows={2} columns={4} showHeader={false} />);
    const thead = container.querySelector("thead");
    expect(thead).toBeNull();
  });

  it("alternates row backgrounds", () => {
    const { container } = render(<TableSkeleton rows={4} columns={2} />);
    const bodyRows = container.querySelectorAll("tbody tr");
    // Odd-indexed rows (0-based) should have bg-muted
    expect(bodyRows[1].className).toContain("bg-muted");
    expect(bodyRows[3].className).toContain("bg-muted");
    // Even-indexed rows should not
    expect(bodyRows[0].className).not.toContain("bg-muted");
  });

  it("first column skeleton is wider than others", () => {
    const { container } = render(<TableSkeleton rows={1} columns={3} />);
    const skeletons = container.querySelectorAll("tbody td div");
    expect(skeletons[0].className).toContain("w-24");
    expect(skeletons[1].className).toContain("w-10");
    expect(skeletons[2].className).toContain("w-10");
  });
});
