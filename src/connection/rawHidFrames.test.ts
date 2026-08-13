import { describe, expect, it } from "vitest";

import {
  ENCODER_PACKET_MARKER,
  HOLD_TAP_PACKET_MARKER,
  HOLD_TAP_PROTOCOL_VERSION,
  KEY_PACKET_MARKER,
  LAYER_PACKET_MARKER,
  POINTER_PACKET_MARKER,
  highestActiveLayer,
  isLayerActive,
  parseRawHidFrame,
} from "./rawHidFrames";

function view(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

describe("parseRawHidFrame", () => {
  it("parses a key press frame (0xf1)", () => {
    expect(parseRawHidFrame(view([KEY_PACKET_MARKER, 0, 12, 1]))).toEqual({
      kind: "key",
      position: 12,
      pressed: true,
    });
  });

  it("parses a key release frame", () => {
    expect(parseRawHidFrame(view([KEY_PACKET_MARKER, 0, 12, 0]))).toEqual({
      kind: "key",
      position: 12,
      pressed: false,
    });
  });

  it("parses a layer frame (0xff) with little-endian mask", () => {
    // defaultLayer=0, active mask = 0b10001 (layers 0 and 4)
    const frame = parseRawHidFrame(
      view([LAYER_PACKET_MARKER, 0, 0, 0, 0, 0, 0b10001, 0, 0, 0]),
    );
    expect(frame).toEqual({
      kind: "layer",
      defaultLayer: 0,
      activeLayerMask: 0b10001,
    });
  });

  it("parses a pointer frame (0xf2) with signed int16 deltas", () => {
    const frame = parseRawHidFrame(
      // dx=-4 (0xfffc LE), dy=12, wheel=1, hwheel=0, buttons=0b101
      view([
        POINTER_PACKET_MARKER,
        0,
        0xfc,
        0xff,
        12,
        0,
        1,
        0,
        0,
        0,
        0b101,
      ]),
    );
    expect(frame).toEqual({
      kind: "pointer",
      dx: -4,
      dy: 12,
      wheel: 1,
      hwheel: 0,
      buttons: 0b101,
    });
  });

  it("parses an encoder frame (0xf3) with signed delta", () => {
    expect(
      parseRawHidFrame(view([ENCODER_PACKET_MARKER, 0, 1, 0xff])),
    ).toEqual({
      kind: "encoder",
      sensor: 1,
      delta: -1,
    });
  });

  it.each([
    [0, "pending"],
    [1, "tap"],
    [2, "hold"],
    [3, "released"],
  ] as const)("parses hold-tap phase %i as %s", (phase, expected) => {
    expect(
      parseRawHidFrame(
        view([
          HOLD_TAP_PACKET_MARKER,
          HOLD_TAP_PROTOCOL_VERSION,
          40,
          phase,
        ]),
      ),
    ).toEqual({ kind: "holdTap", position: 40, phase: expected });
  });

  it("rejects unsupported or malformed hold-tap frames", () => {
    expect(
      parseRawHidFrame(view([HOLD_TAP_PACKET_MARKER, 2, 40, 0])),
    ).toBeNull();
    expect(
      parseRawHidFrame(
        view([HOLD_TAP_PACKET_MARKER, HOLD_TAP_PROTOCOL_VERSION, 40, 4]),
      ),
    ).toBeNull();
    expect(
      parseRawHidFrame(view([HOLD_TAP_PACKET_MARKER, 1, 40])),
    ).toBeNull();
  });

  it("drops unknown markers such as boot mouse reports", () => {
    expect(parseRawHidFrame(view([0x01, 0x02, 0x03, 0x04]))).toBeNull();
  });

  it("drops truncated layer/pointer payloads", () => {
    expect(parseRawHidFrame(view([LAYER_PACKET_MARKER, 0, 1, 0]))).toBeNull();
    expect(
      parseRawHidFrame(view([POINTER_PACKET_MARKER, 0, 1, 0, 0, 0])),
    ).toBeNull();
    expect(parseRawHidFrame(view([KEY_PACKET_MARKER, 0]))).toBeNull();
  });
});

describe("layer mask helpers", () => {
  it("returns the highest active layer", () => {
    expect(highestActiveLayer(0b10001, 0)).toBe(4);
    expect(highestActiveLayer(0b1, 0)).toBe(0);
  });

  it("falls back to the default layer when the mask is empty", () => {
    expect(highestActiveLayer(0, 2)).toBe(2);
  });

  it("reports per-layer activity (auto mouse visibility source)", () => {
    expect(isLayerActive(0b10000, 4)).toBe(true);
    expect(isLayerActive(0b00001, 4)).toBe(false);
  });
});
