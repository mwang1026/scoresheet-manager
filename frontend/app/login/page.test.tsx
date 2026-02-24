import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { signIn } from "next-auth/react";
import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the app title", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /scoresheet manager/i })).toBeInTheDocument();
  });

  it("renders the Sign in with Google button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("calls signIn with google provider on button click", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });
});
