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

  it.each([
    [Uint8Array.from([0x12, 0x00]), "listInputProcessors"],
    [Uint8Array.from([0x22, 0x00]), "setScaleMultiplier"],
    [Uint8Array.from([0x2a, 0x00]), "setScaleDivisor"],
    [Uint8Array.from([0x32, 0x00]), "setRotation"],
    [Uint8Array.from([0x3a, 0x00]), "resetInputProcessor"],
    [Uint8Array.from([0x42, 0x00]), "setTempLayerEnabled"],
    [Uint8Array.from([0x4a, 0x00]), "setTempLayerLayer"],
    [Uint8Array.from([0x52, 0x00]), "setTempLayerActivationDelay"],
    [Uint8Array.from([0x5a, 0x00]), "setTempLayerDeactivationDelay"],
    [Uint8Array.from([0x62, 0x00]), "setActiveLayers"],
    [Uint8Array.from([0x72, 0x00]), "setAxisSnapMode"],
    [Uint8Array.from([0x7a, 0x00]), "setAxisSnapThreshold"],
    [Uint8Array.from([0x82, 0x01, 0x00]), "setAxisSnapTimeout"],
    [Uint8Array.from([0x8a, 0x01, 0x00]), "setXyToScrollEnabled"],
    [Uint8Array.from([0x92, 0x01, 0x00]), "setXySwapEnabled"],
    [Uint8Array.from([0x9a, 0x01, 0x00]), "setXInvert"],
    [Uint8Array.from([0xa2, 0x01, 0x00]), "setYInvert"],
    [Uint8Array.from([0xaa, 0x01, 0x00]), "setScrollLayers"],
  ])("decodes response oneof tag as %s", (response, responseType) => {
    expect(decodeResponse(response).responseType).toBe(responseType);
  });

  it("preserves getInputProcessor payload data with its response type", () => {
    const response = Uint8Array.from([0x1a, 0x04, 0x0a, 0x02, 0x08, 0x07]);

    expect(decodeResponse(response)).toMatchObject({
      responseType: "getInputProcessor",
      getInputProcessor: { id: 7 },
    });
  });

  it("preserves getLayerInfo payload data with its response type", () => {
    const response = Uint8Array.from([0x6a, 0x06, 0x0a, 0x04, 0x08, 0x02, 0x12, 0x00]);

    expect(decodeResponse(response)).toEqual({
      responseType: "getLayerInfo",
      getLayerInfo: [{ index: 2, name: "" }],
    });
  });
});
