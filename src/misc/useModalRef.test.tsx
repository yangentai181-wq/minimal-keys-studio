import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModalRef } from "./useModalRef";

function ModalHarness({ open, outside = false, allowCancel }: { open: boolean; outside?: boolean; allowCancel?: boolean }) {
  const ref = useModalRef(open, outside, allowCancel);
  return <dialog ref={ref}>内容</dialog>;
}

describe("useModalRef", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    HTMLDialogElement.prototype.close = function close() { this.open = false; };
  });

  it("enters when opened and waits before closing when open becomes false", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ModalHarness open={false} />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    const showModal = vi.spyOn(dialog, "showModal");
    const close = vi.spyOn(dialog, "close");

    rerender(<ModalHarness open />);
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog).toHaveAttribute("data-motion-state", "enter");

    rerender(<ModalHarness open={false} />);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(140);
    expect(close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("uses the motion close helper for an outside click", () => {
    vi.useFakeTimers();
    const { container } = render(<ModalHarness open outside />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 100, 100));
    const close = vi.spyOn(dialog, "close");

    fireEvent.mouseDown(dialog, { clientX: 0, clientY: 0 });
    expect(close).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("data-motion-state", "closing");
    vi.advanceTimersByTime(140);
    expect(close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("uses the motion close helper for an allowed Escape cancel", () => {
    vi.useFakeTimers();
    const { container } = render(<ModalHarness open allowCancel />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    const close = vi.spyOn(dialog, "close");

    const event = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(140);
    expect(close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("keeps an Escape cancel open when cancel is not allowed", () => {
    const { container } = render(<ModalHarness open allowCancel={false} />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    const event = new Event("cancel", { cancelable: true });

    dialog.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(dialog).not.toHaveAttribute("data-motion-state", "closing");
  });
});
