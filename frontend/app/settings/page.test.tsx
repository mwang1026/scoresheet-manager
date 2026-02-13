import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "./page";

describe("SettingsPage", () => {
  it("should render Settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });
});
