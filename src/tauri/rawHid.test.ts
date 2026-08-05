import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, listen, unlistenInput, unlistenError, emit } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  unlistenInput: vi.fn(),
  unlistenError: vi.fn(),
  emit: {
    rawHid: (payload: number[]) => void payload,
    rawHidError: (payload: string) => void payload,
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen,
}));

import { connectTauriRawHidMonitor } from "./rawHid";

describe("connectTauriRawHidMonitor", () => {
  beforeEach(() => {
    invoke.mockClear();
    listen.mockClear();
    unlistenInput.mockClear();
    unlistenError.mockClear();
  });

  it("registers input and failure listeners before opening, then cleans both on reader failure", async () => {
    listen.mockImplementation(async (event, callback) => {
      if (event === "raw_hid_input") {
        emit.rawHid = (payload) => callback({ payload });
        return unlistenInput;
      }
      emit.rawHidError = (payload) => callback({ payload });
      return unlistenError;
    });
    const onError = vi.fn();

    await connectTauriRawHidMonitor(vi.fn(), onError);

    expect(listen.mock.invocationCallOrder[0]).toBeLessThan(
      invoke.mock.invocationCallOrder[0],
    );
    expect(listen).toHaveBeenCalledWith("raw_hid_error", expect.any(Function));

    emit.rawHidError("device lost");
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("device lost"));

    expect(unlistenInput).toHaveBeenCalledOnce();
    expect(unlistenError).toHaveBeenCalledOnce();
  });

  it("forwards Tauri HID reports and closes the native reader", async () => {
    listen.mockImplementation(async (event, callback) => {
      if (event === "raw_hid_input") {
        emit.rawHid = (payload) => callback({ payload });
        return unlistenInput;
      }
      emit.rawHidError = (payload) => callback({ payload });
      return unlistenError;
    });
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

    expect(unlistenInput).toHaveBeenCalledOnce();
    expect(unlistenError).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("raw_hid_close");
  });
});
