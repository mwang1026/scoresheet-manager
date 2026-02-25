import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddTeamDialog } from "./add-team-dialog";

vi.mock("@/lib/api", () => ({
  fetchScrapedLeagues: vi.fn(),
  fetchScrapedTeams: vi.fn(),
  addMyTeam: vi.fn(),
}));

import { fetchScrapedLeagues, fetchScrapedTeams, addMyTeam } from "@/lib/api";

const MOCK_LEAGUES = [
  { name: "AL Catfish Hunter", data_path: "FOR_WWW1/AL_Catfish_Hunter" },
  { name: "NL Hank Aaron", data_path: "FOR_WWW1/NL_Hank_Aaron" },
];

const MOCK_TEAMS = [
  { scoresheet_id: 1, owner_name: "Owner One" },
  { scoresheet_id: 2, owner_name: "Owner Two" },
];

describe("AddTeamDialog", () => {
  const onClose = vi.fn();
  const onAdded = vi.fn();

  beforeEach(() => {
    vi.mocked(fetchScrapedLeagues).mockResolvedValue(MOCK_LEAGUES);
    vi.mocked(fetchScrapedTeams).mockResolvedValue(MOCK_TEAMS);
    vi.mocked(addMyTeam).mockResolvedValue({
      id: 3,
      name: "New Team",
      scoresheet_id: 1,
      league_id: 1,
      league_name: "AL Catfish Hunter",
      league_season: 2026,
      role: "owner",
    });
    onClose.mockReset();
    onAdded.mockReset();
  });

  it("does not render when open=false", () => {
    render(<AddTeamDialog open={false} onClose={onClose} onAdded={onAdded} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog and league label when open=true", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add Team" })).toBeInTheDocument();
    // "League" label is always rendered; wait for select to appear after loading
    await waitFor(() => {
      expect(screen.getByLabelText("League")).toBeInTheDocument();
    });
  });

  it("populates league dropdown after fetch", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    await waitFor(() => {
      expect(screen.getByText("AL Catfish Hunter")).toBeInTheDocument();
    });
    expect(screen.getByText("NL Hank Aaron")).toBeInTheDocument();
  });

  it("shows team dropdown after league selection", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    // Wait for leagues to load
    await waitFor(() => {
      expect(screen.getByText("AL Catfish Hunter")).toBeInTheDocument();
    });

    // Select a league
    fireEvent.change(screen.getByLabelText("League"), {
      target: { value: "FOR_WWW1/AL_Catfish_Hunter" },
    });

    // Wait for teams to load
    await waitFor(() => {
      expect(screen.getByText("Team #1 — Owner One")).toBeInTheDocument();
    });
    expect(screen.getByText("Team #2 — Owner Two")).toBeInTheDocument();
  });

  it("Add Team button is disabled until both selections made", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    // Button should be disabled initially
    const addBtn = screen.getByRole("button", { name: /add team/i });
    expect(addBtn).toBeDisabled();

    // Wait for leagues, select one
    await waitFor(() => {
      expect(screen.getByText("AL Catfish Hunter")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("League"), {
      target: { value: "FOR_WWW1/AL_Catfish_Hunter" },
    });

    // Still disabled — no team selected yet
    expect(addBtn).toBeDisabled();

    // Wait for teams, select one
    await waitFor(() => {
      expect(screen.getByText("Team #1 — Owner One")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "1" },
    });

    // Now enabled
    expect(addBtn).not.toBeDisabled();
  });

  it("calls onAdded and onClose on successful submit", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    // Select league + team
    await waitFor(() => screen.getByText("AL Catfish Hunter"));
    fireEvent.change(screen.getByLabelText("League"), {
      target: { value: "FOR_WWW1/AL_Catfish_Hunter" },
    });
    await waitFor(() => screen.getByText("Team #1 — Owner One"));
    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: /add team/i }));

    await waitFor(() => {
      expect(addMyTeam).toHaveBeenCalledWith("FOR_WWW1/AL_Catfish_Hunter", 1);
      expect(onAdded).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error on submission failure", async () => {
    vi.mocked(addMyTeam).mockRejectedValueOnce(new Error("User is already associated"));

    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    await waitFor(() => screen.getByText("AL Catfish Hunter"));
    fireEvent.change(screen.getByLabelText("League"), {
      target: { value: "FOR_WWW1/AL_Catfish_Hunter" },
    });
    await waitFor(() => screen.getByText("Team #1 — Owner One"));
    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: /add team/i }));

    await waitFor(() => {
      expect(screen.getByText("User is already associated")).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on backdrop click", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);
    // Click the backdrop (first fixed inset-0 div behind dialog card)
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key", async () => {
    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error when league fetch fails", async () => {
    vi.mocked(fetchScrapedLeagues).mockRejectedValueOnce(new Error("Network error"));

    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load leagues.")).toBeInTheDocument();
    });
  });

  it("shows error when team fetch fails after league selection", async () => {
    vi.mocked(fetchScrapedTeams).mockRejectedValueOnce(new Error("Network error"));

    render(<AddTeamDialog open={true} onClose={onClose} onAdded={onAdded} />);

    // Wait for leagues to load, then select one
    await waitFor(() => {
      expect(screen.getByText("AL Catfish Hunter")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("League"), {
      target: { value: "FOR_WWW1/AL_Catfish_Hunter" },
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to load teams.")).toBeInTheDocument();
    });
  });
});
