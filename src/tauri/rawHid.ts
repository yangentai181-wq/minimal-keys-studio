import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { parseRawHidFrame, type RawHidFrame } from "../connection/rawHidFrames";
import type { RawHidSubscription } from "../connection/rawHid";

export async function connectTauriRawHidMonitor(
  onFrame: (frame: RawHidFrame) => void,
): Promise<RawHidSubscription | undefined> {
  await invoke("raw_hid_open");
  let unlisten: (() => void) | undefined;
  try {
    unlisten = await listen<number[]>("raw_hid_input", ({ payload }) => {
      const frame = parseRawHidFrame(
        new DataView(Uint8Array.from(payload).buffer),
      );
      if (frame) {
        onFrame(frame);
      }
    });
  } catch (error) {
    await invoke("raw_hid_close");
    throw error;
  }
  let closed = false;

  return {
    device: {} as RawHidSubscription["device"],
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      unlisten?.();
      await invoke("raw_hid_close");
    },
  };
}
