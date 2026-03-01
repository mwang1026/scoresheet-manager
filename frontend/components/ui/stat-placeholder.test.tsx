import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dash, RateDash } from "./stat-placeholder";

describe("Dash", () => {
  it("renders an em dash", () => {
    render(<Dash />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("uses muted foreground styling", () => {
    const { container } = render(<Dash />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-muted-foreground");
  });
});

describe("RateDash", () => {
  it("renders triple dashes", () => {
    render(<RateDash />);
    expect(screen.getByText("---")).toBeDefined();
  });

  it("uses muted foreground styling", () => {
    const { container } = render(<RateDash />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-muted-foreground");
  });
});
