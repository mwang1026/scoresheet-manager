import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — use vi.hoisted to share mock references with the factory
const { mockNext, mockRedirect, mockRewrite } = vi.hoisted(() => ({
  mockNext: vi.fn(() => ({ type: "next" as const })),
  mockRedirect: vi.fn((url: URL) => ({ type: "redirect" as const, url })),
  mockRewrite: vi.fn((url: URL) => ({ type: "rewrite" as const, url })),
}));

vi.mock("@/auth", () => ({
  // Make auth(callback) return callback so the exported default IS the inner function
  auth: (callback: (req: unknown) => unknown) => callback,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: mockNext,
    redirect: mockRedirect,
    rewrite: mockRewrite,
  },
}));

import middleware from "./middleware";

type MockRequest = {
  nextUrl: { pathname: string; search: string };
  url: string;
  headers: Headers;
  auth: { user?: { email?: string } } | null;
};

function createRequest(
  pathname: string,
  options: { auth?: { user?: { email?: string } } | null; search?: string } = {}
): MockRequest {
  return {
    nextUrl: { pathname, search: options.search ?? "" },
    url: `http://localhost${pathname}`,
    headers: new Headers(),
    auth: options.auth !== undefined ? options.auth : null,
  };
}

describe("middleware", () => {
  beforeEach(() => {
    mockNext.mockClear();
    mockRedirect.mockClear();
    mockRewrite.mockClear();
  });

  it("passes /api/auth/* routes through without proxying", () => {
    const req = createRequest("/api/auth/callback/google");
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("passes /login through as a public route", () => {
    const req = createRequest("/login");
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", () => {
    const req = createRequest("/", { auth: null });
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/login");
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
  });

  it("redirects logged-in users away from /login to /", () => {
    const req = createRequest("/login", {
      auth: { user: { email: "user@example.com" } },
    });
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/");
  });

  it("proxies authenticated API requests to backend", () => {
    const req = createRequest("/api/players", {
      auth: { user: { email: "user@example.com" } },
    });
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockRewrite).toHaveBeenCalled();
    const rewriteUrl = mockRewrite.mock.calls[0][0] as URL;
    expect(rewriteUrl.toString()).toBe("http://localhost:8000/api/players");
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("includes query string when proxying API requests", () => {
    const req = createRequest("/api/players", {
      auth: { user: { email: "user@example.com" } },
      search: "?position=SP&limit=50",
    });
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockRewrite).toHaveBeenCalled();
    const rewriteUrl = mockRewrite.mock.calls[0][0] as URL;
    expect(rewriteUrl.toString()).toBe(
      "http://localhost:8000/api/players?position=SP&limit=50"
    );
  });

  it("passes through authenticated page routes without proxying", () => {
    const req = createRequest("/players", {
      auth: { user: { email: "user@example.com" } },
    });
    (middleware as unknown as (req: MockRequest) => unknown)(req);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRewrite).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
