import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraftTimeline } from "./draft-timeline";

describe("DraftTimeline", () => {
  it("should render draft timeline heading", () => {
    render(<DraftTimeline />);
    expect(screen.getByText("Draft Timeline")).toBeInTheDocument();
  });

  it("should render dummy timeline entries", () => {
    render(<DraftTimeline />);
    expect(screen.getByText(/Round 1, Pick 3/)).toBeInTheDocument();
    expect(screen.getByText(/Round 1, Pick 7/)).toBeInTheDocument();
    expect(screen.getByText(/Round 2, Pick 4/)).toBeInTheDocument();
  });

  it("should render time and event for each entry", () => {
    render(<DraftTimeline />);
    expect(screen.getByText(/2:15 PM/)).toBeInTheDocument();
    expect(screen.getAllByText(/Your pick upcoming/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Power Hitters pick/)).toBeInTheDocument();
  });

  it("should render placeholder disclaimer", () => {
    render(<DraftTimeline />);
    expect(screen.getByText(/Placeholder - connect draft schedule in Settings/)).toBeInTheDocument();
  });
});
