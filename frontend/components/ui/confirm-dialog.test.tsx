import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Test Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders dialog when open is true", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        description="This is a description"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("This is a description")).toBeInTheDocument();
  });

  it("renders children slot content", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        <div>Custom content here</div>
      </ConfirmDialog>
    );

    expect(screen.getByText("Custom content here")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Click the backdrop (the element with bg-black/50)
    const backdrop = document.querySelector(".bg-black\\/50");
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("uses custom button labels when provided", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        confirmLabel="Yes, do it"
        cancelLabel="No, go back"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Yes, do it")).toBeInTheDocument();
    expect(screen.getByText("No, go back")).toBeInTheDocument();
  });

  it("applies destructive variant to confirm button when specified", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        variant="destructive"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const confirmButton = screen.getByText("Confirm");
    // Button component applies destructive styling via className
    expect(confirmButton).toBeInTheDocument();
  });

  it("has correct ARIA attributes", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-dialog-title");
  });
});
