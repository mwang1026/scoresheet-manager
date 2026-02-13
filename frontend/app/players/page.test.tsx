import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayersPage from "./page";

describe("PlayersPage", () => {
  it("should render Players heading", () => {
    render(<PlayersPage />);
    expect(screen.getByRole("heading", { name: /players/i })).toBeInTheDocument();
  });
});
