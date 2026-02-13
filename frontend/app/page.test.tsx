import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the heading", () => {
    render(<Home />);
    expect(screen.getByText("Scoresheet Manager")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<Home />);
    expect(
      screen.getByText(/Fantasy baseball management tool/)
    ).toBeInTheDocument();
  });

  it("renders a table with player data", () => {
    render(<Home />);
    expect(screen.getByText("Bobby Witt Jr.")).toBeInTheDocument();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Shohei Ohtani")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<Home />);
    expect(screen.getByText("Player")).toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Docs" })).toBeInTheDocument();
  });
});
