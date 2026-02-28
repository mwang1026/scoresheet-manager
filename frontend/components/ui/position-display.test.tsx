import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PositionDisplay } from "./position-display";

describe("PositionDisplay", () => {
  it("renders catcher with SB/CS rates", () => {
    const player = {
      primary_position: "C",
      eligible_1b: null,
      eligible_2b: null,
      eligible_3b: null,
      eligible_ss: null,
      eligible_of: null,
      osb_al: 0.68,
      ocs_al: 0.24,
    };

    render(<PositionDisplay player={player} />);

    const bold = document.querySelector("span.font-semibold");
    expect(bold?.textContent).toBe("C");
    expect(screen.getByText(/0\.68-0\.24/)).toBeInTheDocument();
  });

  it("renders catcher without rates when null", () => {
    const player = {
      primary_position: "C",
      eligible_1b: null,
      eligible_2b: null,
      eligible_3b: null,
      eligible_ss: null,
      eligible_of: null,
      osb_al: null,
      ocs_al: null,
    };

    render(<PositionDisplay player={player} />);

    const bold = document.querySelector("span.font-semibold");
    expect(bold?.textContent).toBe("C");
    expect(screen.queryByText(/\d\.\d{2}-\d\.\d{2}/)).not.toBeInTheDocument();
  });

  it("boldens primary position for field player", () => {
    const player = {
      primary_position: "SS",
      eligible_1b: null,
      eligible_2b: 0.92,
      eligible_3b: null,
      eligible_ss: 1.85,
      eligible_of: null,
      osb_al: null,
      ocs_al: null,
    };

    render(<PositionDisplay player={player} />);

    const bold = document.querySelector("span.font-semibold");
    expect(bold?.textContent).toContain("SS");
  });

  it("shows secondary positions in muted text", () => {
    const player = {
      primary_position: "SS",
      eligible_1b: null,
      eligible_2b: 0.92,
      eligible_3b: null,
      eligible_ss: 1.85,
      eligible_of: null,
      osb_al: null,
      ocs_al: null,
    };

    render(<PositionDisplay player={player} />);

    const muted = document.querySelector("span.text-muted-foreground");
    expect(muted?.textContent).toContain("2B");
    expect(muted?.textContent).toContain("0.92");
  });

  it("renders single position player without secondary text", () => {
    const player = {
      primary_position: "DH",
      eligible_1b: null,
      eligible_2b: null,
      eligible_3b: null,
      eligible_ss: null,
      eligible_of: null,
      osb_al: null,
      ocs_al: null,
    };

    render(<PositionDisplay player={player} />);

    const bold = document.querySelector("span.font-semibold");
    expect(bold?.textContent).toBe("DH");
    expect(document.querySelector("span.text-muted-foreground")).toBeNull();
  });
});
