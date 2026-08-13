import { describe, it, expect } from "vitest";
import { serializeKeymap, deserializeKeymap } from "./keymap-io";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";

const mockBehaviors: GetBehaviorDetailsResponse[] = [
  { id: 1, displayName: "Key Press", metadata: [] },
  { id: 2, displayName: "Layer-Tap", metadata: [] },
  { id: 3, displayName: "Mod-Tap", metadata: [] },
  { id: 4, displayName: "Momentary Layer", metadata: [] },
  { id: 5, displayName: "None", metadata: [] },
  { id: 6, displayName: "LAYER_TAP_MKP", metadata: [] },
];

const sampleKeymap = {
  layers: [
    {
      id: 0,
      name: "Base",
      bindings: [
        { behaviorId: 1, param1: 0x70004, param2: 0 },
        { behaviorId: 2, param1: 1, param2: 0x7002c },
      ],
    },
    {
      id: 1,
      name: "Symbols",
      bindings: [
        { behaviorId: 5, param1: 0, param2: 0 },
        { behaviorId: 1, param1: 0x70005, param2: 0 },
      ],
    },
  ],
  availableLayers: 3,
  maxLayerNameLength: 16,
};

describe("serializeKeymap", () => {
  it("produces correct format and version", () => {
    const result = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    expect(result.format).toBe("minimal-keys-studio-keymap");
    expect(result.version).toBe(1);
    expect(result.appVersion).toBe("1.0.0");
    expect(result.exportDate).toBeTruthy();
  });

  it("maps behaviorId to displayName", () => {
    const result = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    expect(result.keymap.layers[0].bindings[0].behaviorName).toBe("Key Press");
    expect(result.keymap.layers[0].bindings[1].behaviorName).toBe("Layer-Tap");
  });

  it("preserves layer names and params", () => {
    const result = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    expect(result.keymap.layers[0].name).toBe("Base");
    expect(result.keymap.layers[1].name).toBe("Symbols");
    expect(result.keymap.layers[0].bindings[0].param1).toBe(0x70004);
    expect(result.keymap.layers[0].bindings[1].param2).toBe(0x7002c);
  });

  it("exports minimal-keys auto mouse and scroll layer metadata by ID after reordering", () => {
    const keymapWithFixedLayers = {
      ...sampleKeymap,
      layers: [7, 0, 4].map((id) => ({
        id,
        name: id === 4 ? "Mouse" : id === 7 ? "Scroll" : "Base",
        bindings: sampleKeymap.layers[0].bindings,
      })),
    };
    const result = serializeKeymap(keymapWithFixedLayers, mockBehaviors, "1.0.0");
    expect(result.minimalKeys).toEqual({
      autoMouseLayerId: 4,
      scrollLayerId: 7,
    });
  });

  it("omits minimal-keys metadata when fixed layers do not exist", () => {
    const result = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    expect(result.minimalKeys).toBeUndefined();
  });

  it("omits the device-only precision layer ID from exported user data after reordering", () => {
    const keymapWithPrecisionLayer = {
      ...sampleKeymap,
      layers: [0, 8, 4, 7].map((id) => ({
        id,
        name: id === 8 ? "Precision" : `Layer ${id}`,
        bindings: sampleKeymap.layers[0].bindings,
      })),
    };

    const result = serializeKeymap(keymapWithPrecisionLayer, mockBehaviors, "1.0.0");

    expect(result.keymap.layers).toHaveLength(3);
    expect(result.keymap.layers.map((layer) => layer.name)).not.toContain("Precision");
  });


  it("handles unknown behaviorId gracefully", () => {
    const km = {
      ...sampleKeymap,
      layers: [
        { id: 0, name: "Test", bindings: [{ behaviorId: 999, param1: 0, param2: 0 }] },
      ],
    };
    const result = serializeKeymap(km, mockBehaviors, "1.0.0");
    expect(result.keymap.layers[0].bindings[0].behaviorName).toBe("Unknown(999)");
  });
});

describe("deserializeKeymap", () => {
  function makeValidJson(overrides?: Partial<Record<string, unknown>>): string {
    const exported = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    return JSON.stringify({ ...exported, ...overrides });
  }

  it("round-trip: export then import produces equivalent bindings", () => {
    const json = makeValidJson();
    const result = deserializeKeymap(json, mockBehaviors, 2, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layers.length).toBe(2);
    expect(result.layers[0].name).toBe("Base");
    expect(result.layers[0].bindings[0]).toEqual({ behaviorId: 1, param1: 0x70004, param2: 0 });
    expect(result.layers[0].bindings[1]).toEqual({ behaviorId: 2, param1: 1, param2: 0x7002c });
  });

  it("round-trips a Precision Layer-Tap reference using its persistent layer ID", () => {
    const keymapWithPrecisionLayer = {
      ...sampleKeymap,
      layers: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({
        id,
        name: id === 8 ? "Precision" : `Layer ${id}`,
        bindings: [{ behaviorId: 2, param1: 8, param2: 0x7002c }],
      })),
    };

    const exported = serializeKeymap(keymapWithPrecisionLayer, mockBehaviors, "1.0.0");
    const result = deserializeKeymap(
      JSON.stringify(exported),
      mockBehaviors,
      1,
      9,
      keymapWithPrecisionLayer.layers.map((layer) => layer.id),
    );

    expect(result).toEqual({
      ok: true,
      layers: expect.arrayContaining([
        expect.objectContaining({
          bindings: [{ behaviorId: 2, param1: 8, param2: 0x7002c }],
        }),
      ]),
    });
  });

  it("rejects invalid JSON", () => {
    const result = deserializeKeymap("{bad json", mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("parse");
  });

  it("rejects wrong format string", () => {
    const json = makeValidJson({ format: "wrong-format" });
    const result = deserializeKeymap(json, mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("format");
  });

  it("rejects wrong version", () => {
    const json = makeValidJson({ version: 99 });
    const result = deserializeKeymap(json, mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("format");
  });

  it("rejects unknown behavior name", () => {
    const exported = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    exported.keymap.layers[0].bindings[0].behaviorName = "Nonexistent Behavior";
    const json = JSON.stringify(exported);
    const result = deserializeKeymap(json, mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("behavior");
    if (result.error.type === "behavior") {
      expect(result.error.names).toContain("Nonexistent Behavior");
    }
  });

  it("rejects layer count exceeding device max", () => {
    const json = makeValidJson();
    const result = deserializeKeymap(json, mockBehaviors, 2, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("layerCount");
  });

  it("rejects a legacy nine-layer payload so the device precision layer stays untouched", () => {
    const legacyPayload = JSON.stringify({
      format: "minimal-keys-studio-keymap",
      version: 1,
      keymap: {
        layers: Array.from({ length: 9 }, (_, index) => ({
          name: `Layer ${index}`,
          bindings: sampleKeymap.layers[0].bindings.map((binding) => ({
            behaviorName: binding.behaviorId === 1 ? "Key Press" : "Layer-Tap",
            param1: binding.param1,
            param2: binding.param2,
          })),
        })),
      },
    });

    const result = deserializeKeymap(legacyPayload, mockBehaviors, 2, 9);

    expect(result).toEqual({ ok: false, error: { type: "layerCount", requested: 9, max: 8 } });
  });

  it("rejects binding count mismatch", () => {
    const json = makeValidJson();
    const result = deserializeKeymap(json, mockBehaviors, 3, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("bindingCount");
  });

  it("rejects invalid layer index reference", () => {
    const exported = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    exported.keymap.layers[0].bindings[1].behaviorName = "Momentary Layer";
    exported.keymap.layers[0].bindings[1].param1 = 99;
    exported.keymap.layers[0].bindings[1].param2 = 0;
    const json = JSON.stringify(exported);
    const result = deserializeKeymap(json, mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("layerIndex");
  });

  it("rejects invalid LAYER_TAP_MKP layer index reference", () => {
    const exported = serializeKeymap(sampleKeymap, mockBehaviors, "1.0.0");
    exported.keymap.layers[0].bindings[0].behaviorName = "LAYER_TAP_MKP";
    exported.keymap.layers[0].bindings[0].param1 = 99;
    exported.keymap.layers[0].bindings[0].param2 = 0x01;
    const json = JSON.stringify(exported);
    const result = deserializeKeymap(json, mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("layerIndex");
  });

  it("rejects missing keymap field", () => {
    const result = deserializeKeymap('{"format":"minimal-keys-studio-keymap","version":1}', mockBehaviors, 2, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("format");
  });
});
