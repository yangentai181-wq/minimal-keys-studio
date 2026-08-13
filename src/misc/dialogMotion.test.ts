import { describe, expect, it, vi } from "vitest";

import { closeDialogWithMotion } from "./dialogMotion";

describe("closeDialogWithMotion", () => {
  it("marks an open dialog closing and closes it once after the fallback duration", () => {
    vi.useFakeTimers();
    const dialog = document.createElement("dialog");
    dialog.close = vi.fn();
    Object.defineProperty(dialog, "open", { configurable: true, value: true });

    const cancel = closeDialogWithMotion(dialog, 140);

    expect(dialog).toHaveAttribute("data-motion-state", "closing");
    vi.advanceTimersByTime(140);
    expect(dialog.close).toHaveBeenCalledOnce();
    cancel();
    vi.useRealTimers();
  });

  it("closes once when animation ends before the fallback", () => {
    vi.useFakeTimers();
    const dialog = document.createElement("dialog");
    dialog.close = vi.fn();
    Object.defineProperty(dialog, "open", { configurable: true, value: true });

    closeDialogWithMotion(dialog, 140);
    dialog.dispatchEvent(new Event("animationend"));
    vi.advanceTimersByTime(140);

    expect(dialog.close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("ignores an animation end from a child element", () => {
    vi.useFakeTimers();
    const dialog = document.createElement("dialog");
    const child = document.createElement("div");
    dialog.append(child);
    dialog.close = vi.fn();
    Object.defineProperty(dialog, "open", { configurable: true, value: true });

    closeDialogWithMotion(dialog, 140);
    child.dispatchEvent(new Event("animationend", { bubbles: true }));

    expect(dialog.close).not.toHaveBeenCalled();
    dialog.dispatchEvent(new Event("animationend"));
    expect(dialog.close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("cancels a pending close and clears the closing state", () => {
    vi.useFakeTimers();
    const dialog = document.createElement("dialog");
    dialog.close = vi.fn();
    Object.defineProperty(dialog, "open", { configurable: true, value: true });

    const cancel = closeDialogWithMotion(dialog, 140);
    cancel();
    vi.advanceTimersByTime(140);

    expect(dialog.close).not.toHaveBeenCalled();
    expect(dialog).not.toHaveAttribute("data-motion-state");
    vi.useRealTimers();
  });
});
