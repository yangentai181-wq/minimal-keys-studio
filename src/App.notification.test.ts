import { describe, expect, it, vi } from "vitest";
import { handleNotificationEnd } from "./notificationEnd";

describe("notification stream completion", () => {
  it("runs the snapshot and clear callback after an unexpected stream end", () => {
    const snapshot = vi.fn();
    const clear = vi.fn();

    handleNotificationEnd(false, () => {
      snapshot();
      clear();
    });

    expect(snapshot).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("does not run the snapshot and clear callback after an aborted stream end", () => {
    const onUnexpectedDisconnect = vi.fn();

    handleNotificationEnd(true, onUnexpectedDisconnect);

    expect(onUnexpectedDisconnect).not.toHaveBeenCalled();
  });
});
