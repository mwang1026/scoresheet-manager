import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangeSelect } from "./date-range-select";

describe("DateRangeSelect", () => {
  it("renders Date Range label and select", () => {
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={vi.fn()}
        seasonYear={2026}
      />
    );
    expect(screen.getByText("Date Range:")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders all 6 preset options", () => {
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={vi.fn()}
        seasonYear={2026}
      />
    );
    expect(screen.getByRole("option", { name: "Season to Date" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Week to Date" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last 7 Days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last 14 Days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last 30 Days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Custom Range" })).toBeInTheDocument();
  });

  it("reflects current dateRange type as selected value", () => {
    render(
      <DateRangeSelect
        dateRange={{ type: "last7" }}
        onDateRangeChange={vi.fn()}
        seasonYear={2026}
      />
    );
    expect(screen.getByRole("combobox")).toHaveValue("last7");
  });

  it("emits season DateRange with seasonYear", async () => {
    const user = userEvent.setup();
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "wtd" }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    await user.selectOptions(screen.getByRole("combobox"), "season");
    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "season", year: 2026 });
  });

  it("emits wtd DateRange", async () => {
    const user = userEvent.setup();
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    await user.selectOptions(screen.getByRole("combobox"), "wtd");
    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "wtd" });
  });

  it("emits last7 DateRange", async () => {
    const user = userEvent.setup();
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    await user.selectOptions(screen.getByRole("combobox"), "last7");
    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "last7" });
  });

  it("emits last14 DateRange", async () => {
    const user = userEvent.setup();
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    await user.selectOptions(screen.getByRole("combobox"), "last14");
    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "last14" });
  });

  it("emits last30 DateRange", async () => {
    const user = userEvent.setup();
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    await user.selectOptions(screen.getByRole("combobox"), "last30");
    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "last30" });
  });

  it("emits custom DateRange with default dates when switching to custom", async () => {
    const user = userEvent.setup();
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    await user.selectOptions(screen.getByRole("combobox"), "custom");
    expect(onDateRangeChange).toHaveBeenCalledWith({
      type: "custom",
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("does not show date inputs when type is not custom", () => {
    render(
      <DateRangeSelect
        dateRange={{ type: "season", year: 2026 }}
        onDateRangeChange={vi.fn()}
        seasonYear={2026}
      />
    );
    expect(screen.queryByDisplayValue("2026-01-01")).not.toBeInTheDocument();
  });

  it("shows date inputs when type is custom", () => {
    render(
      <DateRangeSelect
        dateRange={{ type: "custom", start: "2026-04-01", end: "2026-04-30" }}
        onDateRangeChange={vi.fn()}
        seasonYear={2026}
      />
    );
    expect(screen.getByDisplayValue("2026-04-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-30")).toBeInTheDocument();
  });

  it("initializes custom inputs from dateRange.start/end", () => {
    render(
      <DateRangeSelect
        dateRange={{ type: "custom", start: "2026-05-01", end: "2026-05-31" }}
        onDateRangeChange={vi.fn()}
        seasonYear={2026}
      />
    );
    expect(screen.getByDisplayValue("2026-05-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-05-31")).toBeInTheDocument();
  });

  it("emits updated custom DateRange on start input blur", () => {
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "custom", start: "2026-04-01", end: "2026-04-30" }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    onDateRangeChange.mockClear();
    const startInput = screen.getByDisplayValue("2026-04-01");
    fireEvent.blur(startInput);
    expect(onDateRangeChange).toHaveBeenCalledWith({
      type: "custom",
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });

  it("emits updated custom DateRange on end input blur", () => {
    const onDateRangeChange = vi.fn();
    render(
      <DateRangeSelect
        dateRange={{ type: "custom", start: "2026-04-01", end: "2026-04-30" }}
        onDateRangeChange={onDateRangeChange}
        seasonYear={2026}
      />
    );
    onDateRangeChange.mockClear();
    const endInput = screen.getByDisplayValue("2026-04-30");
    fireEvent.blur(endInput);
    expect(onDateRangeChange).toHaveBeenCalledWith({
      type: "custom",
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });
});
