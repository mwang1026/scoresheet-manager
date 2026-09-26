import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatsSourceToggle } from "./stats-source-toggle";

describe("StatsSourceToggle", () => {
  it("renders Stats Source label and all three buttons in order", () => {
    render(<StatsSourceToggle value="actual" onChange={vi.fn()} />);
    expect(screen.getByText("Stats Source:")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Actual",
      "Projected",
      "Playoff",
    ]);
  });

  it("highlights Playoff and calls onChange with 'playoff'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<StatsSourceToggle value="actual" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Playoff" }));
    expect(onChange).toHaveBeenCalledWith("playoff");
    rerender(<StatsSourceToggle value="playoff" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Playoff" })).toHaveClass("bg-brand/15");
    expect(screen.getByRole("button", { name: "Actual" })).not.toHaveClass("bg-brand/15");
  });

  it("highlights Actual button when value is actual", () => {
    render(<StatsSourceToggle value="actual" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Actual" })).toHaveClass("bg-brand/15");
    expect(screen.getByRole("button", { name: "Projected" })).not.toHaveClass("bg-brand/15");
  });

  it("highlights Projected button when value is projected", () => {
    render(<StatsSourceToggle value="projected" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Projected" })).toHaveClass("bg-brand/15");
    expect(screen.getByRole("button", { name: "Actual" })).not.toHaveClass("bg-brand/15");
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
