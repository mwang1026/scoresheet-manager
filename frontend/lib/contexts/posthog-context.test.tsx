import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

// The module-level posthog.init() runs at import time when NEXT_PUBLIC_POSTHOG_KEY is set.
// Since vitest.setup.ts doesn't set it, the init guard (`typeof window !== "undefined" && key`)
// won't fire on import. We test the identify/reset effects instead.
import { PostHogProvider } from "./posthog-context";

describe("PostHogProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children", () => {
    const { getByText } = render(
      createElement(PostHogProvider, null, createElement("span", null, "hello"))
    );
    expect(getByText("hello")).toBeInTheDocument();
  });

  it("identifies user when session is authenticated", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phk_test_key");

    vi.mocked(useSession).mockReturnValue({
      data: { user: { email: "user@example.com" }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });

    render(createElement(PostHogProvider, null, createElement("div")));

    expect(posthog.identify).toHaveBeenCalledWith("user@example.com");

    vi.unstubAllEnvs();
  });

  it("calls reset when unauthenticated", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phk_test_key");

    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    render(createElement(PostHogProvider, null, createElement("div")));

    expect(posthog.reset).toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it("does not identify or reset when key is empty", () => {
    // NEXT_PUBLIC_POSTHOG_KEY is not set → guard prevents identify/reset
    vi.mocked(useSession).mockReturnValue({
      data: { user: { email: "user@example.com" }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });

    render(createElement(PostHogProvider, null, createElement("div")));

    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("does not identify when session has no email", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phk_test_key");

    vi.mocked(useSession).mockReturnValue({
      data: { user: {}, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });

    render(createElement(PostHogProvider, null, createElement("div")));

    expect(posthog.identify).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
