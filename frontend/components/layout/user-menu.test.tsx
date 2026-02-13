import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("should render placeholder email", () => {
    render(<UserMenu />);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("should render logout text", () => {
    render(<UserMenu />);
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });
});
