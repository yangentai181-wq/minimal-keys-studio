// Right-hand USB device detection + diagnostics logging.
// Detection is non-interactive: it only inspects devices/ports the user
// has already granted. The interactive pickers live in rawHid.ts and
// transport/serial.ts.

import { getWebHid, hasRawHidCollection, type HidLike } from "./rawHid";

export type UsbDeviceDiagnostics = {
  source: "webhid" | "webserial";
  vendorId?: number;
  productId?: number;
  productName?: string;
};

export type RightUsbDetection = {
  hidDevices: UsbDeviceDiagnostics[];
  serialPorts: UsbDeviceDiagnostics[];
  /** A granted vendor Raw HID (0xff60/0x61) interface is visible. */
  rawHidVisible: boolean;
  /** Any granted serial port is visible. */
  serialVisible: boolean;
};

type SerialLike = {
  getPorts(): Promise<Array<{ getInfo(): SerialPortInfo }>>;
};

function getWebSerial(): SerialLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  const serial = (navigator as unknown as { serial?: SerialLike }).serial;
  return serial ?? null;
}

function formatUsbId(value?: number): string {
  return value === undefined
    ? "?"
    : `0x${value.toString(16).padStart(4, "0")}`;
}

export async function detectRightUsbDevice(
  hid: HidLike | null = getWebHid(),
  serial: SerialLike | null = getWebSerial(),
): Promise<RightUsbDetection> {
  const hidDevices: UsbDeviceDiagnostics[] = [];
  const serialPorts: UsbDeviceDiagnostics[] = [];
  let rawHidVisible = false;

  if (hid) {
    try {
      const devices = await hid.getDevices();
      for (const device of devices) {
        hidDevices.push({
          source: "webhid",
          vendorId: device.vendorId,
          productId: device.productId,
          productName: device.productName,
        });
        if (hasRawHidCollection(device)) {
          rawHidVisible = true;
        }
      }
    } catch (error) {
      console.warn("[usb-detect] WebHID getDevices failed:", error);
    }
  }

  if (serial) {
    try {
      const ports = await serial.getPorts();
      for (const port of ports) {
        const info = port.getInfo();
        serialPorts.push({
          source: "webserial",
          vendorId: info.usbVendorId,
          productId: info.usbProductId,
        });
      }
    } catch (error) {
      console.warn("[usb-detect] WebSerial getPorts failed:", error);
    }
  }

  return {
    hidDevices,
    serialPorts,
    rawHidVisible,
    serialVisible: serialPorts.length > 0,
  };
}

export function logRightUsbDetection(detection: RightUsbDetection): void {
  for (const device of detection.hidDevices) {
    console.info(
      `[usb-detect] WebHID device: vid=${formatUsbId(device.vendorId)} pid=${formatUsbId(device.productId)} product=${device.productName ?? "?"}`,
    );
  }
  for (const port of detection.serialPorts) {
    console.info(
      `[usb-detect] WebSerial port: vid=${formatUsbId(port.vendorId)} pid=${formatUsbId(port.productId)}`,
    );
  }
  if (detection.hidDevices.length === 0 && detection.serialPorts.length === 0) {
    console.info(
      "[usb-detect] No granted USB devices visible yet (picker prompt required on first connect).",
    );
  }
}
