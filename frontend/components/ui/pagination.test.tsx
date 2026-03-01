import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination, buildPageList } from "./pagination";

describe("buildPageList", () => {
  it("shows all pages when total <= 7", () => {
    expect(buildPageList(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(buildPageList(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("shows ellipsis for large page counts", () => {
    const pages = buildPageList(0, 20);
    expect(pages).toContain("ellipsis");
    expect(pages[0]).toBe(0);
    expect(pages[pages.length - 1]).toBe(19);
  });

  it("always shows first and last page", () => {
    const pages = buildPageList(10, 20);
    expect(pages[0]).toBe(0);
    expect(pages[pages.length - 1]).toBe(19);
  });

  it("shows left ellipsis when current page is far from start", () => {
    const pages = buildPageList(15, 20);
    expect(pages).toContain("ellipsis");
  });

  it("returns empty array for 0 pages", () => {
    expect(buildPageList(0, 0)).toEqual([]);
  });

  it("returns single page for 1 page", () => {
    expect(buildPageList(0, 1)).toEqual([0]);
  });
});

describe("Pagination", () => {
  const defaultProps = {
    currentPage: 0,
    totalPages: 5,
    pageSize: 50,
    totalItems: 230,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it("renders Previous and Next buttons", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText("Previous")).toBeDefined();
    expect(screen.getByText("Next")).toBeDefined();
  });

  it("disables Previous on first page", () => {
    render(<Pagination {...defaultProps} currentPage={0} />);
    const prev = screen.getByText("Previous");
    expect(prev.closest("button")).toHaveProperty("disabled", true);
  });

  it("disables Next on last page", () => {
    render(<Pagination {...defaultProps} currentPage={4} totalPages={5} />);
    const next = screen.getByText("Next");
    expect(next.closest("button")).toHaveProperty("disabled", true);
  });

  it("shows correct item range", () => {
    render(<Pagination {...defaultProps} currentPage={0} pageSize={50} totalItems={230} />);
    expect(screen.getByText(/Showing 1-50 of 230/)).toBeDefined();
  });

  it("calls onPageChange when clicking Next", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange when clicking Previous", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("Previous"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageSizeChange when selecting page size", () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "20" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it("renders custom pageSizeOptions", () => {
    render(<Pagination {...defaultProps} pageSizeOptions={[10, 25, 50]} />);
    expect(screen.getByText("10 per page")).toBeDefined();
    expect(screen.getByText("25 per page")).toBeDefined();
  });

  it("highlights current page button", () => {
    render(<Pagination {...defaultProps} currentPage={2} totalPages={5} />);
    // Page 3 (index 2) button should have the active class
    const page3Button = screen.getByText("3");
    expect(page3Button.className).toContain("bg-brand/15");
  });
});
