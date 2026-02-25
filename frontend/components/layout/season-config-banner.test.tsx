import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeasonConfigBanner } from "./season-config-banner";

describe("SeasonConfigBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("renders nothing when season config exists for the current year (2026)", () => {
    // 2026 is in SEASON_CONFIG, so banner should NOT show
    vi.setSystemTime(new Date(2026, 5, 15)); // Jun 15 2026
    render(<SeasonConfigBanner />);
    expect(screen.queryByText(/haven't been configured/i)).toBeNull();
  });

  it("renders banner when season config is missing for the current year", () => {
    // 2027 is not in SEASON_CONFIG
    vi.setSystemTime(new Date(2027, 1, 15)); // Feb 15 2027
    render(<SeasonConfigBanner />);
    expect(screen.getByText(/haven't been configured yet/i)).toBeInTheDocument();
    expect(screen.getByText(/2027/)).toBeInTheDocument();
  });

  it("hides banner after dismiss button is clicked", () => {
    vi.setSystemTime(new Date(2027, 1, 15)); // Feb 15 2027
    render(<SeasonConfigBanner />);
    expect(screen.getByText(/haven't been configured yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/haven't been configured yet/i)).toBeNull();
  });

  it("stores dismissed flag in sessionStorage after clicking dismiss", () => {
    vi.setSystemTime(new Date(2027, 1, 15));
    render(<SeasonConfigBanner />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(sessionStorage.getItem("season-config-banner-dismissed")).toBe("1");
  });

  it("stays hidden if sessionStorage flag already set", () => {
    vi.setSystemTime(new Date(2027, 1, 15));
    sessionStorage.setItem("season-config-banner-dismissed", "1");

    render(<SeasonConfigBanner />);
    expect(screen.queryByText(/haven't been configured yet/i)).toBeNull();
  });
});
