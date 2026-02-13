import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("should render Dashboard heading", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});
