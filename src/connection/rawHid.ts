// WebHID Raw HID monitor channel for the right-hand (central) USB device.
// This is the PRIMARY realtime-monitor path: it works even when the
// keyboard's selected output endpoint is BLE and Studio RPC is therefore
// not listening on the USB CDC port.

import {
  RAW_HID_USAGE,
  RAW_HID_USAGE_PAGE,
  parseRawHidFrame,
  type RawHidFrame,
} from "./rawHidFrames";

type HidCollectionLike = { usagePage?: number; usage?: number };

export type HidInputReportEventLike = Event & {
  reportId: number;
  data: DataView;
};

export type HidDeviceLike = {
  productName?: string;
  vendorId?: number;
  productId?: number;
  opened: boolean;
  collections: ReadonlyArray<HidCollectionLike>;
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: "inputreport", listener: EventListener): void;
  removeEventListener(type: "inputreport", listener: EventListener): void;
};

export type HidLike = {
  getDevices(): Promise<HidDeviceLike[]>;
  requestDevice(options: {
    filters: Array<{
      vendorId?: number;
      productId?: number;
      usagePage?: number;
      usage?: number;
    }>;
  }): Promise<HidDeviceLike[]>;
};

export function getWebHid(): HidLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  const hid = (navigator as unknown as { hid?: HidLike }).hid;
  return hid ?? null;
}

export function hasRawHidCollection(device: HidDeviceLike): boolean {
  return device.collections.some(
    (c) => c.usagePage === RAW_HID_USAGE_PAGE && c.usage === RAW_HID_USAGE,
  );
}

/** Find an already-permitted Raw HID device without prompting the user. */
export async function findGrantedRawHidDevice(
  hid: HidLike,
): Promise<HidDeviceLike | undefined> {
  const devices = await hid.getDevices();
  return devices.find(hasRawHidCollection);
}

/** Prompt the user for a Raw HID device (vendor usage page 0xff60). */
export async function requestRawHidDevice(
  hid: HidLike,
): Promise<HidDeviceLike | undefined> {
  const devices = await hid.requestDevice({
    filters: [{ usagePage: RAW_HID_USAGE_PAGE, usage: RAW_HID_USAGE }],
  });
  return devices.find(hasRawHidCollection) ?? devices[0];
}

export type RawHidSubscription = {
  device: HidDeviceLike;
  close(): Promise<void>;
};

/**
 * Open the device and stream parsed Raw HID frames to `onFrame`.
 * Unknown reports (boot keyboard / mouse) are dropped by the parser.
 */
export async function openRawHidMonitor(
  device: HidDeviceLike,
  onFrame: (frame: RawHidFrame) => void,
): Promise<RawHidSubscription> {
  if (!device.opened) {
    await device.open();
  }

  const listener: EventListener = (event) => {
    const report = event as HidInputReportEventLike;
    const frame = parseRawHidFrame(report.data);
    if (frame) {
      onFrame(frame);
    }
  };
  device.addEventListener("inputreport", listener);

  return {
    device,
    close: async () => {
      device.removeEventListener("inputreport", listener);
      if (device.opened) {
        try {
          await device.close();
        } catch {
          // Closing an already-lost device is fine.
        }
      }
    },
  };
}

/**
 * Full monitor connect flow: reuse an already-granted device when possible,
 * otherwise prompt. Returns undefined when the user cancels the picker.
 */
export async function connectRawHidMonitor(
  onFrame: (frame: RawHidFrame) => void,
  hid: HidLike | null = getWebHid(),
  interactive = true,
): Promise<RawHidSubscription | undefined> {
  if (!hid) {
    throw new Error(
      "このブラウザは WebHID に対応していません。Chrome / Edge をお使いください。",
    );
  }

  let device = await findGrantedRawHidDevice(hid);
  if (!device && interactive) {
    device = await requestRawHidDevice(hid);
  }
  if (!device) {
    return undefined;
  }

  return openRawHidMonitor(device, onFrame);
}
