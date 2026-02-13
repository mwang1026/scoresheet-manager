import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DraftPage from "./page";

describe("DraftPage", () => {
  it("should render Draft heading", () => {
    render(<DraftPage />);
    expect(screen.getByRole("heading", { name: /draft/i })).toBeInTheDocument();
  });
});
