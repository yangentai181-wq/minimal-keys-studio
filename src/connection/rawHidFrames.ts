// Raw HID frame contract shared with the minimal-keys firmware modules
// (zzeneg/zmk-raw-hid + keypeek layer notifier + zmk-input-notifier).
// Reference implementation: zmk-web-configurator/lib/use-webhid.ts.

export const RAW_HID_USAGE_PAGE = 0xff60;
export const RAW_HID_USAGE = 0x61;

export const KEY_PACKET_MARKER = 0xf1;
export const LAYER_PACKET_MARKER = 0xff;
export const POINTER_PACKET_MARKER = 0xf2;
export const ENCODER_PACKET_MARKER = 0xf3;
export const HOLD_TAP_PACKET_MARKER = 0xf4;
export const HOLD_TAP_PROTOCOL_VERSION = 0x01;

export type KeyFrame = {
  kind: "key";
  position: number;
  pressed: boolean;
};

export type LayerFrame = {
  kind: "layer";
  defaultLayer: number;
  activeLayerMask: number;
};

export type PointerFrame = {
  kind: "pointer";
  dx: number;
  dy: number;
  wheel: number;
  hwheel: number;
  buttons: number;
};

export type EncoderFrame = {
  kind: "encoder";
  sensor: number;
  delta: number;
};

export type HoldTapPhase = "pending" | "tap" | "hold" | "released";

export type HoldTapFrame = {
  kind: "holdTap";
  position: number;
  phase: HoldTapPhase;
};

export type RawHidFrame =
  | KeyFrame
  | LayerFrame
  | PointerFrame
  | EncoderFrame
  | HoldTapFrame;

const HOLD_TAP_PHASES: readonly HoldTapPhase[] = [
  "pending",
  "tap",
  "hold",
  "released",
];

/**
 * Parse one WebHID input report payload into a typed Raw HID frame.
 * Returns null for unknown markers or truncated payloads (e.g. the
 * high-rate boot mouse reports WebHID also delivers to the listener).
 */
export function parseRawHidFrame(data: DataView): RawHidFrame | null {
  if (data.byteLength < 4) {
    return null;
  }

  const marker = data.getUint8(0);

  switch (marker) {
    case KEY_PACKET_MARKER:
      return {
        kind: "key",
        position: data.getUint8(2),
        pressed: data.getUint8(3) === 1,
      };
    case LAYER_PACKET_MARKER: {
      if (data.byteLength < 10) {
        return null;
      }
      return {
        kind: "layer",
        defaultLayer: data.getUint32(2, true),
        activeLayerMask: data.getUint32(6, true),
      };
    }
    case POINTER_PACKET_MARKER: {
      if (data.byteLength < 11) {
        return null;
      }
      return {
        kind: "pointer",
        dx: data.getInt16(2, true),
        dy: data.getInt16(4, true),
        wheel: data.getInt16(6, true),
        hwheel: data.getInt16(8, true),
        buttons: data.getUint8(10),
      };
    }
    case ENCODER_PACKET_MARKER:
      return {
        kind: "encoder",
        sensor: data.getUint8(2),
        delta: data.getInt8(3),
      };
    case HOLD_TAP_PACKET_MARKER: {
      if (data.getUint8(1) !== HOLD_TAP_PROTOCOL_VERSION) {
        return null;
      }
      const phase = HOLD_TAP_PHASES[data.getUint8(3)];
      if (!phase) {
        return null;
      }
      return {
        kind: "holdTap",
        position: data.getUint8(2),
        phase,
      };
    }
    default:
      return null;
  }
}

/** Highest set bit in the active layer mask, or the default layer if none. */
export function highestActiveLayer(
  activeLayerMask: number,
  defaultLayer: number,
): number {
  for (let i = 31; i >= 0; i--) {
    if ((activeLayerMask & (1 << i)) !== 0) {
      return i;
    }
  }
  return defaultLayer;
}

/** True when the given layer index is currently active in the mask. */
export function isLayerActive(activeLayerMask: number, index: number): boolean {
  return (activeLayerMask & (1 << index)) !== 0;
}
