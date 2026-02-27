import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipOverlay } from "./tooltip-overlay";
import { createRef } from "react";

describe("TooltipOverlay", () => {
  it("renders children", () => {
    const ref = createRef<HTMLSpanElement>();
    // Create a real span element to use as ref
    const span = document.createElement("span");
    span.getBoundingClientRect = () => ({
      top: 100, left: 100, bottom: 120, right: 120,
      width: 20, height: 20, x: 100, y: 100, toJSON: () => {},
    });
    (ref as React.MutableRefObject<HTMLSpanElement>).current = span;

    render(
      <TooltipOverlay iconRef={ref}>
        <span>Tooltip content</span>
      </TooltipOverlay>
    );

    expect(screen.getByText("Tooltip content")).toBeInTheDocument();
  });

  it("applies fixed positioning", () => {
    const ref = createRef<HTMLSpanElement>();
    const span = document.createElement("span");
    span.getBoundingClientRect = () => ({
      top: 100, left: 100, bottom: 120, right: 120,
      width: 20, height: 20, x: 100, y: 100, toJSON: () => {},
    });
    (ref as React.MutableRefObject<HTMLSpanElement>).current = span;

    const { container } = render(
      <TooltipOverlay iconRef={ref}>Content</TooltipOverlay>
    );

    const tooltip = container.firstElementChild;
    expect(tooltip).toHaveClass("fixed");
  });
});
