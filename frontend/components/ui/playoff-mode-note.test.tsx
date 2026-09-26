import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayoffModeNote } from "./playoff-mode-note";

describe("PlayoffModeNote", () => {
  it("shows the window, the weight, and the series caps", () => {
    render(<PlayoffModeNote seasonYear={2026} />);
    const note = screen.getByTestId("playoff-mode-note");
    expect(note.textContent).toContain("Aug 31 – Sep 27");
    expect(note.textContent).toContain("×3.33");
    expect(note.textContent).toContain("40% PA / 45% IP");
  });
});
