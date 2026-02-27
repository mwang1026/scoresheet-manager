import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ILIcon, formatILDate } from "./il-icon";

describe("ILIcon", () => {
  it("renders nothing when ilType is null", () => {
    const { container } = render(<ILIcon ilType={null} ilDate={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders cross icon when ilType is set", () => {
    render(<ILIcon ilType="10-Day IL" ilDate="2026-02-14" />);
    const span = document.querySelector("span");
    expect(span).toBeInTheDocument();
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("icon has red color class", () => {
    render(<ILIcon ilType="10-Day IL" ilDate="2026-02-14" />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("text-red-500");
  });

  it("does not have cursor-pointer class", () => {
    render(<ILIcon ilType="60-Day IL" ilDate="2026-01-10" />);
    const span = document.querySelector("span");
    expect(span).not.toHaveClass("cursor-pointer");
  });
});

describe("formatILDate", () => {
  it("formats date string correctly", () => {
    expect(formatILDate("2026-02-14")).toBe("Feb 14");
    expect(formatILDate("2026-01-01")).toBe("Jan 1");
    expect(formatILDate("2026-12-25")).toBe("Dec 25");
  });
});
