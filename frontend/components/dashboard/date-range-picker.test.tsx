import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangePicker } from "./date-range-picker";

describe("DateRangePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-09")); // Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all preset buttons", () => {
    const onDateRangeChange = vi.fn();
    render(
      <DateRangePicker
        dateRange={{ type: "wtd" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    expect(screen.getByText("WTD")).toBeInTheDocument();
    expect(screen.getByText("L7")).toBeInTheDocument();
    expect(screen.getByText("L14")).toBeInTheDocument();
    expect(screen.getByText("L30")).toBeInTheDocument();
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("highlights active preset with brand blue", () => {
    const onDateRangeChange = vi.fn();
    render(
      <DateRangePicker
        dateRange={{ type: "last7" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    const l7Button = screen.getByText("L7");
    expect(l7Button).toHaveClass("bg-brand-blue");
  });

  it("changes preset when preset button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "wtd" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    await user.click(screen.getByText("L14"));

    expect(onDateRangeChange).toHaveBeenCalledWith({ type: "last14" });
  });

  it("shows custom date inputs when custom preset is active", async () => {
    const user = userEvent.setup({ delay: null });
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "wtd" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    await user.click(screen.getByText("Custom"));

    // Should show two date inputs
    const dateInputs = screen.getAllByLabelText(/date/i);
    expect(dateInputs).toHaveLength(2);
  });

  it("updates date range when custom dates are entered", async () => {
    const user = userEvent.setup({ delay: null });
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "custom", start: "", end: "" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    const [startInput, endInput] = screen.getAllByLabelText(/date/i);

    await user.type(startInput, "2025-07-01");
    await user.type(endInput, "2025-07-07");

    expect(onDateRangeChange).toHaveBeenLastCalledWith({
      type: "custom",
      start: "2025-07-01",
      end: "2025-07-07",
    });
  });

  it("displays date label for WTD preset", () => {
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "wtd" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    // Today is Wed July 9, so Monday is July 7
    expect(screen.getByText(/Jul 7 – Jul 9/)).toBeInTheDocument();
  });

  it("displays date label for last7 preset", () => {
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "last7" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    // 7 days ago from July 9 is July 2
    expect(screen.getByText(/Jul 2 – Jul 9/)).toBeInTheDocument();
  });

  it("displays date label for season preset", () => {
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "season" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    expect(screen.getByText("2025 Season")).toBeInTheDocument();
  });

  it("displays date label for custom range", () => {
    const onDateRangeChange = vi.fn();

    render(
      <DateRangePicker
        dateRange={{ type: "custom", start: "2025-06-01", end: "2025-06-30" }}
        onDateRangeChange={onDateRangeChange}
      />
    );

    expect(screen.getByText(/Jun 1 – Jun 30/)).toBeInTheDocument();
  });

  describe("back/forward navigation", () => {
    it("shifts backward by 7 days for L7 preset", async () => {
      const user = userEvent.setup({ delay: null });
      const onDateRangeChange = vi.fn();

      render(
        <DateRangePicker
          dateRange={{ type: "last7" }}
          onDateRangeChange={onDateRangeChange}
        />
      );

      const backButton = screen.getByLabelText("Previous period");
      await user.click(backButton);

      // Should emit custom range shifted back 7 days
      expect(onDateRangeChange).toHaveBeenCalledWith({
        type: "custom",
        start: "2025-06-25", // 14 days ago
        end: "2025-07-02", // 7 days ago
      });
    });

    it("shifts backward by 7 days for WTD preset (Monday-based)", async () => {
      const user = userEvent.setup({ delay: null });
      const onDateRangeChange = vi.fn();

      render(
        <DateRangePicker
          dateRange={{ type: "wtd" }}
          onDateRangeChange={onDateRangeChange}
        />
      );

      const backButton = screen.getByLabelText("Previous period");
      await user.click(backButton);

      // Should emit previous week: June 30 (Mon) - July 6 (Sun)
      expect(onDateRangeChange).toHaveBeenCalledWith({
        type: "custom",
        start: "2025-06-30",
        end: "2025-07-06",
      });
    });

    it("shifts forward when offset is negative", async () => {
      const user = userEvent.setup({ delay: null });
      const onDateRangeChange = vi.fn();

      render(
        <DateRangePicker
          dateRange={{ type: "last7" }}
          onDateRangeChange={onDateRangeChange}
        />
      );

      // Go backward first
      const backButton = screen.getByLabelText("Previous period");
      await user.click(backButton);

      onDateRangeChange.mockClear();

      // Now go forward
      const forwardButton = screen.getByLabelText("Next period");
      await user.click(forwardButton);

      // Should reset to original preset
      expect(onDateRangeChange).toHaveBeenCalledWith({ type: "last7" });
    });

    it("disables forward button when offset is 0", () => {
      const onDateRangeChange = vi.fn();

      render(
        <DateRangePicker
          dateRange={{ type: "last7" }}
          onDateRangeChange={onDateRangeChange}
        />
      );

      const forwardButton = screen.getByLabelText("Next period");
      expect(forwardButton).toBeDisabled();
    });

    it("disables back/forward buttons for season preset", () => {
      const onDateRangeChange = vi.fn();

      render(
        <DateRangePicker
          dateRange={{ type: "season" }}
          onDateRangeChange={onDateRangeChange}
        />
      );

      const backButton = screen.getByLabelText("Previous period");
      const forwardButton = screen.getByLabelText("Next period");

      expect(backButton).toBeDisabled();
      expect(forwardButton).toBeDisabled();
    });

    it("resets offset when changing presets", async () => {
      const user = userEvent.setup({ delay: null });
      const onDateRangeChange = vi.fn();

      render(
        <DateRangePicker
          dateRange={{ type: "last7" }}
          onDateRangeChange={onDateRangeChange}
        />
      );

      // Go backward
      const backButton = screen.getByLabelText("Previous period");
      await user.click(backButton);

      // Switch to different preset
      await user.click(screen.getByText("L14"));

      expect(onDateRangeChange).toHaveBeenLastCalledWith({ type: "last14" });
    });
  });
});
