import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { signIn } from "next-auth/react";
import SignInButton from "./SignInButton";

describe("SignInButton", () => {
  it("renders with correct text", () => {
    render(<SignInButton />);
    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it("calls signIn with google provider and callbackUrl on click", () => {
    render(<SignInButton />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });
});
