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

  it("shows no error message when no error param is present", () => {
    const { container } = render(<LoginPage />);
    // Error paragraph uses text-destructive; subtitle uses text-muted-foreground
    expect(container.querySelector(".text-destructive")).toBeNull();
  });

  it("shows AccessDenied error message for email not allowed", () => {
    render(<LoginPage searchParams={{ error: "AccessDenied" }} />);
    expect(
      screen.getByText(/your email is not authorized/i)
    ).toBeInTheDocument();
  });

  it("shows generic error message for unknown error codes", () => {
    render(<LoginPage searchParams={{ error: "SomeUnknownError" }} />);
    expect(screen.getByText(/Auth error: SomeUnknownError/)).toBeInTheDocument();
  });

  it("shows OAuthCallbackError message", () => {
    render(<LoginPage searchParams={{ error: "OAuthCallbackError" }} />);
    expect(screen.getByText(/oauth callback error/i)).toBeInTheDocument();
  });
});
