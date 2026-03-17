import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftNotesWidget } from "./draft-notes-widget";

// Mock the hook
const mockSave = vi.fn();
const mockContent = { current: "My draft notes" };
vi.mock("@/lib/hooks/use-draft-notes", () => ({
  useDraftNotes: () => ({
    content: mockContent.current,
    save: mockSave,
  }),
}));

// Mock sessionStorage
const sessionStorageMap = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => sessionStorageMap.set(key, value),
  removeItem: (key: string) => sessionStorageMap.delete(key),
  clear: () => sessionStorageMap.clear(),
});

describe("DraftNotesWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContent.current = "My draft notes";
    sessionStorageMap.clear();
  });

  it("renders expanded by default with content", () => {
    render(<DraftNotesWidget />);
    expect(screen.getByText("Draft Notes")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("My draft notes");
  });

  it("collapses when header is clicked", async () => {
    const user = userEvent.setup();
    render(<DraftNotesWidget />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();

    await user.click(screen.getByText("Draft Notes"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(sessionStorageMap.get("draft-notes-collapsed")).toBe("true");
  });

  it("expands when header is clicked while collapsed", async () => {
    sessionStorageMap.set("draft-notes-collapsed", "true");
    const user = userEvent.setup();
    render(<DraftNotesWidget />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByText("Draft Notes"));

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(sessionStorageMap.get("draft-notes-collapsed")).toBe("false");
  });

  it("Save button is disabled when content matches server", () => {
    render(<DraftNotesWidget />);
    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it("Save button enabled after editing, calls save on click", async () => {
    const user = userEvent.setup();
    render(<DraftNotesWidget />);

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "New strategy");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).not.toBeDisabled();

    await user.click(saveBtn);
    expect(mockSave).toHaveBeenCalledWith("New strategy");
  });

  it("renders with empty content", () => {
    mockContent.current = "";
    render(<DraftNotesWidget />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
