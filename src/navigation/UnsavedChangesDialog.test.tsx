import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

describe("UnsavedChangesDialog", () => {
  it("offers save, discard, and return actions in Japanese", () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    render(<UnsavedChangesDialog open onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />);

    expect(screen.getByText("変更を保存しますか？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存して移動" }));
    fireEvent.click(screen.getByRole("button", { name: "破棄して移動" }));
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
