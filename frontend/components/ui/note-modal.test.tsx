import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NoteModal } from "./note-modal";

describe("NoteModal", () => {
  const defaultProps = {
    open: true,
    playerName: "Mike Trout",
    initialContent: "",
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when closed", () => {
    render(<NoteModal {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders player name as title", () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByText("Mike Trout")).toBeInTheDocument();
  });

  it("renders textarea with placeholder", () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByPlaceholderText("Add a note...")).toBeInTheDocument();
  });

  it('shows "Save Note" for new notes', () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByText("Save Note")).toBeInTheDocument();
  });

  it('shows "Save Changes" when editing existing note', () => {
    render(<NoteModal {...defaultProps} initialContent="Existing note" />);
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("pre-fills textarea with initialContent", () => {
    render(<NoteModal {...defaultProps} initialContent="Breakout year" />);
    const textarea = screen.getByPlaceholderText("Add a note...");
    expect(textarea).toHaveValue("Breakout year");
  });

  it("calls onSave with current content on save button click", async () => {
    const onSave = vi.fn();
    render(<NoteModal {...defaultProps} onSave={onSave} />);

    const textarea = screen.getByPlaceholderText("Add a note...");
    await userEvent.type(textarea, "Draft target");

    fireEvent.click(screen.getByText("Save Note"));
    expect(onSave).toHaveBeenCalledWith("Draft target");
  });

  it("calls onCancel on cancel button click", () => {
    const onCancel = vi.fn();
    render(<NoteModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel on Escape key", () => {
    const onCancel = vi.fn();
    render(<NoteModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel on backdrop click", () => {
    const onCancel = vi.fn();
    render(<NoteModal {...defaultProps} onCancel={onCancel} />);

    // Click the backdrop (the div with bg-black/50)
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
