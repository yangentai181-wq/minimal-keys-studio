import { describe, expect, it, vi } from "vitest";

const { invoke, unlisten, emit } = vi.hoisted(() => ({
  invoke: vi.fn(),
  unlisten: vi.fn(),
  emit: { rawHid: (payload: number[]) => void payload },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_event, callback) => {
    emit.rawHid = (payload) => callback({ payload });
    return unlisten;
  }),
}));

import { connectTauriRawHidMonitor } from "./rawHid";

describe("connectTauriRawHidMonitor", () => {
  it("forwards Tauri HID reports and closes the native reader", async () => {
    const onFrame = vi.fn();
    const subscription = await connectTauriRawHidMonitor(onFrame);

    emit.rawHid([0xf1, 0, 23, 1]);

    expect(invoke).toHaveBeenCalledWith("raw_hid_open");
    expect(onFrame).toHaveBeenCalledWith({
      kind: "key",
      position: 23,
      pressed: true,
    });

    await subscription?.close();

    expect(unlisten).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("raw_hid_close");
  });
});
