import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSession, signOut } from "next-auth/react";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("shows the user email from session", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { email: "user@example.com" }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });
    render(<UserMenu />);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("shows 'Not signed in' when unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });
    render(<UserMenu />);
    expect(screen.getByText("Not signed in")).toBeInTheDocument();
  });

  it("calls signOut on logout click", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { email: "user@example.com" }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });
    render(<UserMenu />);
    fireEvent.click(screen.getByText("Log out"));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
