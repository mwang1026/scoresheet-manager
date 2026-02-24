import { describe, it, expect, vi } from "vitest";
import { checkEmailAllowed } from "./auth";

// Prevent NextAuth from initializing during import
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}));

describe("checkEmailAllowed", () => {
  it("returns true when backend says allowed", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ allowed: true }),
    } as Response);

    const result = await checkEmailAllowed("allowed@example.com");
    expect(result).toBe(true);
  });

  it("returns false when backend says not allowed", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ allowed: false }),
    } as Response);

    const result = await checkEmailAllowed("denied@example.com");
    expect(result).toBe(false);
  });

  it("returns false when backend returns non-200", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await checkEmailAllowed("test@example.com");
    expect(result).toBe(false);
  });

  it("returns false when backend is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const result = await checkEmailAllowed("test@example.com");
    expect(result).toBe(false);
  });

  it("calls the correct backend endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ allowed: true }),
    } as Response);
    global.fetch = mockFetch;

    await checkEmailAllowed("test@example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/check-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      })
    );
  });
});
