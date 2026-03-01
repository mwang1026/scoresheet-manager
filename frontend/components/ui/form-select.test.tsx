import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { FormSelect } from "./form-select";

describe("FormSelect", () => {
  it("renders a select element", () => {
    render(
      <FormSelect data-testid="sel">
        <option value="a">A</option>
      </FormSelect>
    );
    const sel = screen.getByTestId("sel");
    expect(sel.tagName).toBe("SELECT");
  });

  it("applies default size classes", () => {
    render(<FormSelect data-testid="sel"><option>A</option></FormSelect>);
    const sel = screen.getByTestId("sel");
    expect(sel.className).toContain("px-3");
    expect(sel.className).toContain("py-1");
  });

  it("applies small size classes", () => {
    render(<FormSelect selectSize="sm" data-testid="sel"><option>A</option></FormSelect>);
    const sel = screen.getByTestId("sel");
    expect(sel.className).toContain("px-2");
    expect(sel.className).toContain("py-1");
  });

  it("applies fullWidth class", () => {
    render(<FormSelect fullWidth data-testid="sel"><option>A</option></FormSelect>);
    const sel = screen.getByTestId("sel");
    expect(sel.className).toContain("w-full");
  });

  it("does not include w-full by default", () => {
    render(<FormSelect data-testid="sel"><option>A</option></FormSelect>);
    const sel = screen.getByTestId("sel");
    expect(sel.className).not.toContain("w-full");
  });

  it("forwards ref to the select element", () => {
    const ref = createRef<HTMLSelectElement>();
    render(<FormSelect ref={ref}><option value="x">X</option></FormSelect>);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("SELECT");
  });

  it("passes through onChange and other native props", () => {
    const onChange = vi.fn();
    render(
      <FormSelect data-testid="sel" onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </FormSelect>
    );
    fireEvent.change(screen.getByTestId("sel"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("includes focus ring classes", () => {
    render(<FormSelect data-testid="sel"><option>A</option></FormSelect>);
    const sel = screen.getByTestId("sel");
    expect(sel.className).toContain("focus:ring-2");
    expect(sel.className).toContain("focus:ring-ring");
  });

  it("appends custom className", () => {
    render(<FormSelect className="my-custom" data-testid="sel"><option>A</option></FormSelect>);
    const sel = screen.getByTestId("sel");
    expect(sel.className).toContain("my-custom");
    expect(sel.className).toContain("border");
  });
});
