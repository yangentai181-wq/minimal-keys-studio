import { describe, expect, it } from "vitest";
import { decodeResponse, encodeSetScrollLayers } from "./rip";

describe("RIP protocol", () => {
  it("decodes scroll_layers from InputProcessorInfo field 18", () => {
    const response = Uint8Array.from([
      0x1a, 0x06, 0x0a, 0x04, 0x90, 0x01, 0x80, 0x01,
    ]);

    expect(decodeResponse(response).getInputProcessor?.scrollLayers).toBe(128);
  });

  it("encodes SetScrollLayers as request field 20", () => {
    expect([...encodeSetScrollLayers(3, 128)]).toEqual([
      0xa2, 0x01, 0x05, 0x08, 0x03, 0x10, 0x80, 0x01,
    ]);
  });

  it("distinguishes an empty transport response from a SetScrollLayers response", () => {
    expect(decodeResponse(new Uint8Array()).responseType).toBeUndefined();
    expect(decodeResponse(Uint8Array.from([0xaa, 0x01, 0x00])).responseType)
      .toBe("setScrollLayers");
  });
});
