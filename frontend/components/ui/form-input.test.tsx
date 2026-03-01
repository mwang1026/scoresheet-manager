import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { FormInput } from "./form-input";

describe("FormInput", () => {
  it("renders an input element", () => {
    render(<FormInput data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.tagName).toBe("INPUT");
  });

  it("applies default size classes", () => {
    render(<FormInput data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.className).toContain("px-3");
    expect(inp.className).toContain("py-1");
  });

  it("applies small size classes", () => {
    render(<FormInput inputSize="sm" data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.className).toContain("px-2");
    expect(inp.className).toContain("py-1");
  });

  it("applies fullWidth class", () => {
    render(<FormInput fullWidth data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.className).toContain("w-full");
  });

  it("does not include w-full by default", () => {
    render(<FormInput data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.className).not.toContain("w-full");
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<FormInput ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("INPUT");
  });

  it("passes through onChange and other native props", () => {
    const onChange = vi.fn();
    render(<FormInput data-testid="inp" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("inp"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("supports type prop", () => {
    render(<FormInput data-testid="inp" type="date" />);
    const inp = screen.getByTestId("inp") as HTMLInputElement;
    expect(inp.type).toBe("date");
  });

  it("includes focus ring classes", () => {
    render(<FormInput data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.className).toContain("focus:ring-2");
    expect(inp.className).toContain("focus:ring-ring");
  });

  it("appends custom className", () => {
    render(<FormInput className="my-custom" data-testid="inp" />);
    const inp = screen.getByTestId("inp");
    expect(inp.className).toContain("my-custom");
    expect(inp.className).toContain("border");
  });
});
