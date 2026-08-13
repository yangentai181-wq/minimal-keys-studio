import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { parseRawHidFrame, type RawHidFrame } from "../connection/rawHidFrames";
import type { RawHidSubscription } from "../connection/rawHid";

export async function connectTauriRawHidMonitor(
  onFrame: (frame: RawHidFrame) => void,
  onError?: (reason: string) => void,
): Promise<RawHidSubscription | undefined> {
  let closed = false;
  let unlistenInput: (() => void) | undefined;
  let unlistenError: (() => void) | undefined;
  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    unlistenInput?.();
    unlistenError?.();
    await invoke("raw_hid_close");
  };

  try {
    unlistenInput = await listen<number[]>("raw_hid_input", ({ payload }) => {
      const frame = parseRawHidFrame(
        new DataView(Uint8Array.from(payload).buffer),
      );
      if (frame) {
        onFrame(frame);
      }
    });
    unlistenError = await listen<string>("raw_hid_error", ({ payload }) => {
      void close().then(() => onError?.(payload));
    });
    await invoke("raw_hid_open");
  } catch (error) {
    unlistenInput?.();
    unlistenError?.();
    await invoke("raw_hid_close");
    throw error;
  }

  return {
    device: {} as RawHidSubscription["device"],
    close,
  };
}
