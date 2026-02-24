import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterDropdown } from "./filter-dropdown";

const OPTIONS = [
  { value: "C", label: "C" },
  { value: "1B", label: "1B" },
  { value: "2B", label: "2B" },
];

describe("FilterDropdown", () => {
  it("renders the label as button text when nothing selected", () => {
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /position/i })).toBeInTheDocument();
  });

  it("shows count badge when items are selected", () => {
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set(["C", "1B"])}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /position \(2\)/i })).toBeInTheDocument();
  });

  it("panel is hidden by default", () => {
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("opens panel on button click", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));

    expect(screen.getAllByRole("checkbox").length).toBe(OPTIONS.length);
  });

  it("closes panel on second button click", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={vi.fn()}
      />
    );

    const btn = screen.getByRole("button", { name: /position/i });
    await user.click(btn);
    expect(screen.getAllByRole("checkbox").length).toBe(OPTIONS.length);

    await user.click(btn);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("calls onChange with toggled value when checkbox clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));
    await user.click(screen.getByRole("checkbox", { name: "C" }));

    expect(onChange).toHaveBeenCalledWith(new Set(["C"]));
  });

  it("calls onChange removing value when already-checked checkbox clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set(["C"])}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));
    await user.click(screen.getByRole("checkbox", { name: "C" }));

    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it("All link selects all options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));
    await user.click(screen.getByRole("button", { name: /^all$/i }));

    expect(onChange).toHaveBeenCalledWith(new Set(["C", "1B", "2B"]));
  });

  it("Clear link deselects all options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set(["C", "1B"])}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));
    await user.click(screen.getByRole("button", { name: /clear/i }));

    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it("closes panel on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set()}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));
    expect(screen.getAllByRole("checkbox").length).toBe(OPTIONS.length);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows checked state for selected options", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        label="Position"
        options={OPTIONS}
        selected={new Set(["1B"])}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /position/i }));

    const checkboxC = screen.getByRole("checkbox", { name: "C" });
    const checkbox1B = screen.getByRole("checkbox", { name: "1B" });

    expect(checkboxC).not.toBeChecked();
    expect(checkbox1B).toBeChecked();
  });
});
