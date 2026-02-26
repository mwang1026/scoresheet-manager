import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDateTime, isWithinHours } from "./format";

describe("formatDateTime", () => {
  it("returns formatted date string matching expected pattern", () => {
    const result = formatDateTime("2025-03-15T13:00:00-07:00");
    // Pattern: "Mon D, HH:MM (TZZ)" — timezone abbreviation varies by env
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2} \(.+\)$/);
  });

  it("includes correct month and day", () => {
    const result = formatDateTime("2025-03-15T13:00:00-07:00");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
  });

  it("returns empty string for invalid input", () => {
    expect(formatDateTime("not-a-date")).toBe("");
  });
});

describe("isWithinHours", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when pick time is within the hour window", () => {
    // Set "now" to exactly the pick time
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2025-03-15T13:00:00-07:00").getTime()
    );
    expect(isWithinHours("2025-03-15T13:00:00-07:00", 24)).toBe(true);
  });

  it("returns true when pick time is slightly less than hours away", () => {
    const pickTime = new Date("2025-03-15T13:00:00-07:00").getTime();
    // Set now to 23 hours before pick
    vi.spyOn(Date, "now").mockReturnValue(pickTime - 23 * 3600000);
    expect(isWithinHours("2025-03-15T13:00:00-07:00", 24)).toBe(true);
  });

  it("returns false when pick time is more than hours away", () => {
    const pickTime = new Date("2025-03-15T13:00:00-07:00").getTime();
    // Set now to 25 hours before pick
    vi.spyOn(Date, "now").mockReturnValue(pickTime - 25 * 3600000);
    expect(isWithinHours("2025-03-15T13:00:00-07:00", 24)).toBe(false);
  });

  it("returns false for invalid input", () => {
    expect(isWithinHours("not-a-date", 24)).toBe(false);
  });
});
