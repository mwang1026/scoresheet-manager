import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNav } from "./bottom-nav";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

describe("BottomNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("should render nav element with aria-label", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: /mobile navigation/i });
    expect(nav).toBeInTheDocument();
  });

  it("should render 3 primary navigation items", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /draft/i })).toBeInTheDocument();
  });

  it("should render More button", () => {
    render(<BottomNav />);
    expect(screen.getByRole("button", { name: /more/i })).toBeInTheDocument();
  });

  it("should not show overflow menu initially", () => {
    render(<BottomNav />);
    expect(screen.queryByRole("link", { name: /opponents/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("should show overflow menu when More is clicked", async () => {
    const user = userEvent.setup();
    render(<BottomNav />);

    const moreButton = screen.getByRole("button", { name: /more/i });
    await user.click(moreButton);

    expect(screen.getByRole("link", { name: /opponents/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("should highlight active route", () => {
    mockUsePathname.mockReturnValue("/");

    render(<BottomNav />);
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("should highlight active route in overflow menu", async () => {
    const user = userEvent.setup();
    mockUsePathname.mockReturnValue("/opponents");

    render(<BottomNav />);

    const moreButton = screen.getByRole("button", { name: /more/i });
    await user.click(moreButton);

    const opponentsLink = screen.getByRole("link", { name: /opponents/i });
    expect(opponentsLink).toHaveAttribute("aria-current", "page");
  });

  it("should close overflow menu when clicking outside", async () => {
    const user = userEvent.setup();
    render(<BottomNav />);

    const moreButton = screen.getByRole("button", { name: /more/i });
    await user.click(moreButton);

    expect(screen.getByRole("link", { name: /opponents/i })).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("link", { name: /opponents/i })).not.toBeInTheDocument();
  });

  it("should have correct href attributes", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /players/i })).toHaveAttribute("href", "/players");
    expect(screen.getByRole("link", { name: /draft/i })).toHaveAttribute("href", "/draft");
  });
});
