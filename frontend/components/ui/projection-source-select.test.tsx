import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectionSourceSelect } from "./projection-source-select";

const SOURCES = ["PECOTA", "Steamer", "ZiPS"];

describe("ProjectionSourceSelect", () => {
  it("renders Source label and select", () => {
    render(<ProjectionSourceSelect value="PECOTA" sources={SOURCES} onChange={vi.fn()} />);
    expect(screen.getByText("Source:")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders an option for each source", () => {
    render(<ProjectionSourceSelect value="PECOTA" sources={SOURCES} onChange={vi.fn()} />);
    for (const source of SOURCES) {
      expect(screen.getByRole("option", { name: source })).toBeInTheDocument();
    }
  });

  it("shows current value as selected", () => {
    render(<ProjectionSourceSelect value="Steamer" sources={SOURCES} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("Steamer");
  });

  it("calls onChange with selected value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionSourceSelect value="PECOTA" sources={SOURCES} onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "ZiPS");
    expect(onChange).toHaveBeenCalledWith("ZiPS");
  });

  it("renders nothing when sources is empty", () => {
    render(<ProjectionSourceSelect value="" sources={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
