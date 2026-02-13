import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OpponentsPage from "./page";

describe("OpponentsPage", () => {
  it("should render Opponents heading", () => {
    render(<OpponentsPage />);
    expect(screen.getByRole("heading", { name: /opponents/i })).toBeInTheDocument();
  });
});
