import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatsSourceToggle } from "./stats-source-toggle";

describe("StatsSourceToggle", () => {
  it("renders Stats Source label and both buttons", () => {
    render(<StatsSourceToggle value="actual" onChange={vi.fn()} />);
    expect(screen.getByText("Stats Source:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Projected" })).toBeInTheDocument();
  });

  it("highlights Actual button when value is actual", () => {
    render(<StatsSourceToggle value="actual" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Actual" })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Projected" })).not.toHaveClass("bg-primary");
  });

  it("highlights Projected button when value is projected", () => {
    render(<StatsSourceToggle value="projected" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Projected" })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Actual" })).not.toHaveClass("bg-primary");
  });

  it("calls onChange with 'actual' when Actual clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatsSourceToggle value="projected" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Actual" }));
    expect(onChange).toHaveBeenCalledWith("actual");
  });

  it("calls onChange with 'projected' when Projected clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatsSourceToggle value="actual" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Projected" }));
    expect(onChange).toHaveBeenCalledWith("projected");
  });
});
