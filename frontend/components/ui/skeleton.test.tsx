import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a div with animate-pulse", () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.tagName).toBe("DIV");
    expect(div.className).toContain("animate-pulse");
  });

  it("includes bg-muted and rounded classes", () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("bg-muted");
    expect(div.className).toContain("rounded");
  });

  it("appends custom className", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("h-4");
    expect(div.className).toContain("w-20");
    expect(div.className).toContain("animate-pulse");
  });
});
