import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SortIndicator } from "./sort-indicator";

describe("SortIndicator", () => {
  it("renders nothing when not active", () => {
    const { container } = render(<SortIndicator active={false} direction="asc" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders ChevronUp when active and direction is asc", () => {
    const { container } = render(<SortIndicator active={true} direction="asc" />);
    // ChevronUp renders an svg
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // lucide renders the icon name as a class or data attribute — verify it exists
    expect(container.firstChild).not.toBeNull();
  });

  it("renders ChevronDown when active and direction is desc", () => {
    const { container } = render(<SortIndicator active={true} direction="desc" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders different SVG paths for asc vs desc", () => {
    const { container: ascContainer } = render(<SortIndicator active={true} direction="asc" />);
    const { container: descContainer } = render(<SortIndicator active={true} direction="desc" />);
    const ascHtml = ascContainer.innerHTML;
    const descHtml = descContainer.innerHTML;
    expect(ascHtml).not.toBe(descHtml);
  });
});
