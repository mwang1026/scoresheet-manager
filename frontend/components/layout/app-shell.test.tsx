import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

describe("AppShell", () => {
  it("should render children", () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should render main element", () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
  });

  it("should render navigation elements", () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );
    const mainNav = screen.getByRole("navigation", { name: /main navigation/i });
    const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(mainNav).toBeInTheDocument();
    expect(mobileNav).toBeInTheDocument();
  });
});
