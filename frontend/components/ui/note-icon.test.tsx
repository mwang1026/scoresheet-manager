import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoteIcon } from "./note-icon";

describe("NoteIcon", () => {
  const defaultProps = {
    playerId: 42,
    playerName: "Mike Trout",
    noteContent: "",
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders gray icon when no note", () => {
    const { container } = render(<NoteIcon {...defaultProps} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.className.baseVal || svg?.getAttribute("class")).toContain(
      "text-muted-foreground/40"
    );
  });

  it("renders blue icon when note exists", () => {
    const { container } = render(
      <NoteIcon {...defaultProps} noteContent="My note" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.className.baseVal || svg?.getAttribute("class")).toContain(
      "text-brand"
    );
  });

  it("opens modal on click", () => {
    render(<NoteIcon {...defaultProps} />);
    const svg = document.querySelector("svg")!;
    fireEvent.click(svg);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Mike Trout")).toBeInTheDocument();
  });

  it("calls onSave with playerId and content on modal save", () => {
    const onSave = vi.fn();
    render(<NoteIcon {...defaultProps} onSave={onSave} />);

    // Open modal
    const svg = document.querySelector("svg")!;
    fireEvent.click(svg);

    // Type in textarea
    const textarea = screen.getByPlaceholderText("Add a note...");
    fireEvent.change(textarea, { target: { value: "New note" } });

    // Save
    fireEvent.click(screen.getByText("Save Note"));
    expect(onSave).toHaveBeenCalledWith(42, "New note");
  });

  it("shows tooltip after hover delay when note exists", () => {
    render(<NoteIcon {...defaultProps} noteContent="Hover text" />);

    const iconWrapper = document.querySelector("span")!;
    fireEvent.mouseEnter(iconWrapper);

    // Not visible yet
    expect(screen.queryByText("Hover text")).not.toBeInTheDocument();

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("Hover text")).toBeInTheDocument();
  });

  it("does not show tooltip on hover when no note", () => {
    render(<NoteIcon {...defaultProps} />);

    const iconWrapper = document.querySelector("span")!;
    fireEvent.mouseEnter(iconWrapper);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // No tooltip since there's no note content
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", () => {
    render(<NoteIcon {...defaultProps} noteContent="Hover text" />);

    const iconWrapper = document.querySelector("span")!;
    fireEvent.mouseEnter(iconWrapper);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("Hover text")).toBeInTheDocument();

    fireEvent.mouseLeave(iconWrapper);
    expect(screen.queryByText("Hover text")).not.toBeInTheDocument();
  });

  it("stops propagation on click", () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <NoteIcon {...defaultProps} />
      </div>
    );

    const svg = document.querySelector("svg")!;
    fireEvent.click(svg);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
