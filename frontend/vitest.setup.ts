import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Setup localStorage polyfill
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

global.localStorage = new LocalStorageMock() as Storage;

// Mock watchlist and queue storage for tests
let mockWatchlist: number[] = [];
let mockQueue: number[] = [];

// Setup fetch mock for API calls
global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
  const urlString = typeof url === "string" ? url : url.toString();

  // Mock watchlist endpoints
  if (urlString.includes("/api/watchlist")) {
    const method = init?.method || "GET";

    if (method === "GET") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockWatchlist }),
      } as Response);
    }

    if (method === "POST") {
      const body = JSON.parse(init?.body as string);
      const playerId = body.player_id;
      if (!mockWatchlist.includes(playerId)) {
        mockWatchlist.push(playerId);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockWatchlist }),
      } as Response);
    }

    if (method === "DELETE") {
      const playerId = parseInt(urlString.split("/").pop() || "0");
      mockWatchlist = mockWatchlist.filter((id) => id !== playerId);
      mockQueue = mockQueue.filter((id) => id !== playerId);
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockWatchlist }),
      } as Response);
    }
  }

  // Mock draft queue endpoints
  if (urlString.includes("/api/draft-queue")) {
    const method = init?.method || "GET";

    if (urlString.includes("/reorder") && method === "PUT") {
      const body = JSON.parse(init?.body as string);
      mockQueue = body.player_ids;
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockQueue }),
      } as Response);
    }

    if (method === "GET") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockQueue }),
      } as Response);
    }

    if (method === "POST") {
      const body = JSON.parse(init?.body as string);
      const playerId = body.player_id;
      if (!mockQueue.includes(playerId)) {
        mockQueue.push(playerId);
      }
      if (!mockWatchlist.includes(playerId)) {
        mockWatchlist.push(playerId);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockQueue }),
      } as Response);
    }

    if (method === "DELETE") {
      const playerId = parseInt(urlString.split("/").pop() || "0");
      mockQueue = mockQueue.filter((id) => id !== playerId);
      return Promise.resolve({
        ok: true,
        json: async () => ({ player_ids: mockQueue }),
      } as Response);
    }
  }

  // Mock me/teams endpoint (must come before /api/teams to avoid substring match)
  if (urlString.includes("/api/me/teams")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        teams: [
          {
            id: 1,
            name: "My Team",
            scoresheet_id: 1,
            league_id: 1,
            league_name: "Alpha League",
            league_season: 2025,
            role: "owner",
          },
          {
            id: 2,
            name: "Other Team",
            scoresheet_id: 2,
            league_id: 1,
            league_name: "Alpha League",
            league_season: 2025,
            role: "co-owner",
          },
        ],
      }),
    } as Response);
  }

  // Mock teams endpoint
  if (urlString.includes("/api/teams")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        teams: [
          { id: 1, name: "My Team", scoresheet_id: 1, league_id: 1, is_my_team: true },
          { id: 2, name: "Other Team", scoresheet_id: 2, league_id: 1, is_my_team: false },
        ],
      }),
    } as Response);
  }

  // Default fallback
  return Promise.reject(new Error(`Unhandled fetch call: ${urlString}`));
}) as typeof fetch;

beforeEach(() => {
  global.localStorage.clear();
  mockWatchlist = [];
  mockQueue = [];
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});
