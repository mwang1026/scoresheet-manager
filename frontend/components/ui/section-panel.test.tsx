import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SectionPanel } from "./section-panel";

describe("SectionPanel", () => {
  it("renders the title", () => {
    render(<SectionPanel title="My Hitters">content</SectionPanel>);
    expect(screen.getByText("My Hitters")).toBeInTheDocument();
  });

  it("renders the badge when provided", () => {
    render(
      <SectionPanel title="My Hitters" badge="14 rostered">
        content
      </SectionPanel>
    );
    expect(screen.getByText("14 rostered")).toBeInTheDocument();
  });

  it("renders the action slot when provided", () => {
    render(
      <SectionPanel title="Test" action={<button>Manage</button>}>
        content
      </SectionPanel>
    );
    expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <SectionPanel title="Test">
        <div data-testid="child">Hello</div>
      </SectionPanel>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("has amber top border class", () => {
    const { container } = render(
      <SectionPanel title="Test">content</SectionPanel>
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("border-t-brand");
  });

  it("applies custom className", () => {
    const { container } = render(
      <SectionPanel title="Test" className="mt-4">
        content
      </SectionPanel>
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("mt-4");
  });
});
