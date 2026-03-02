import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportQueueModal } from "./export-queue-modal";
import type { Player } from "@/lib/fixtures";

const mockPlayer1: Player = {
  id: 1,
  name: "Aaron Judge",
  current_team: "NYY",
  primary_position: "OF",
  mlb_id: 592450,
  scoresheet_id: 12345,
  hand: "R",
  age: 31,
  team_id: 1,
  eligible_1b: null,
  eligible_2b: null,
  eligible_3b: null,
  eligible_ss: null,
  eligible_of: 9,
  osb_al: null,
  ocs_al: null,
  ba_vr: 10,
  ob_vr: 15,
  sl_vr: 20,
  ba_vl: -5,
  ob_vl: -3,
  sl_vl: -10,
  il_type: null,
  il_date: null,
};

const mockPlayer2: Player = {
  id: 2,
  name: "Gerrit Cole",
  current_team: "NYY",
  primary_position: "P",
  mlb_id: 543037,
  scoresheet_id: 54321,
  hand: "R",
  age: 33,
  team_id: 1,
  eligible_1b: null,
  eligible_2b: null,
  eligible_3b: null,
  eligible_ss: null,
  eligible_of: null,
  osb_al: null,
  ocs_al: null,
  ba_vr: null,
  ob_vr: null,
  sl_vr: null,
  ba_vl: null,
  ob_vl: null,
  sl_vl: null,
  il_type: null,
  il_date: null,
};

const mockPlayer3: Player = {
  id: 3,
  name: "Shohei Ohtani",
  current_team: "LAD",
  primary_position: "DH",
  mlb_id: 660271,
  scoresheet_id: 99999,
  hand: "L",
  age: 31,
  team_id: 2,
  eligible_1b: null,
  eligible_2b: null,
  eligible_3b: null,
  eligible_ss: null,
  eligible_of: null,
  osb_al: null,
  ocs_al: null,
  ba_vr: 10,
  ob_vr: 15,
  sl_vr: 20,
  ba_vl: -5,
  ob_vl: -3,
  sl_vl: -10,
  il_type: null,
  il_date: null,
};

describe("ExportQueueModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnClose.mockClear();
  });

  it("renders title, textarea, and copy button when open", () => {
    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1]}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Export Draft Queue")).toBeInTheDocument();
    expect(screen.getByLabelText("Formatted queue text")).toBeInTheDocument();
    expect(screen.getByText("Copy to Clipboard")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ExportQueueModal
        open={false}
        players={[mockPlayer1]}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText("Export Draft Queue")).not.toBeInTheDocument();
  });

  it("formats textarea content as scoresheet_id followed by name", () => {
    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1, mockPlayer2]}
        onClose={mockOnClose}
      />
    );

    const textarea = screen.getByLabelText("Formatted queue text") as HTMLTextAreaElement;
    expect(textarea.value).toBe("12345 Aaron Judge\n54321 Gerrit Cole");
  });

  it("preserves player order in export", () => {
    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer3, mockPlayer1, mockPlayer2]}
        onClose={mockOnClose}
      />
    );

    const textarea = screen.getByLabelText("Formatted queue text") as HTMLTextAreaElement;
    const lines = textarea.value.split("\n");
    expect(lines[0]).toBe("99999 Shohei Ohtani");
    expect(lines[1]).toBe("12345 Aaron Judge");
    expect(lines[2]).toBe("54321 Gerrit Cole");
  });

  it("calls navigator.clipboard.writeText with correct text on copy click", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1, mockPlayer2]}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByText("Copy to Clipboard"));

    expect(writeTextMock).toHaveBeenCalledWith(
      "12345 Aaron Judge\n54321 Gerrit Cole"
    );
  });

  it("changes button text to Copied! after click", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1]}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByText("Copy to Clipboard"));

    expect(screen.getByText("Copied!")).toBeInTheDocument();
    expect(screen.queryByText("Copy to Clipboard")).not.toBeInTheDocument();
  });

  it("closes on X button click", async () => {
    const user = userEvent.setup();

    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1]}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByLabelText("Close"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();

    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1]}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByTestId("export-modal-backdrop"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();

    render(
      <ExportQueueModal
        open={true}
        players={[mockPlayer1]}
        onClose={mockOnClose}
      />
    );

    await user.keyboard("{Escape}");

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows empty state message when players array is empty", () => {
    render(
      <ExportQueueModal
        open={true}
        players={[]}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Your draft queue is empty.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Formatted queue text")).not.toBeInTheDocument();
    expect(screen.queryByText("Copy to Clipboard")).not.toBeInTheDocument();
  });
});
