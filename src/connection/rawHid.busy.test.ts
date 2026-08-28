import { describe, expect, it, vi } from "vitest";

import { openRawHidMonitor } from "./rawHid";

function deviceThatFailsToOpen(message: string) {
  return {
    opened: false,
    open: vi.fn().mockRejectedValue(new DOMException(message, "InvalidStateError")),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
  };
}

describe("openRawHidMonitor", () => {
  it("explains that another tab holds the keyboard instead of surfacing the browser error", async () => {
    const device = deviceThatFailsToOpen("Failed to open the device.");

    await expect(
      openRawHidMonitor(device as never, vi.fn()),
    ).rejects.toThrow(/他のタブ|使用中/);
  });
});
