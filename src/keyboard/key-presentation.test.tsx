import { describe, expect, it } from "vitest";
import { buildKeyPresentation } from "./key-presentation";

const layout = { keys: [{ x: 0, y: 0, width: 100, height: 100 }] };
const behaviors = { 1: { id: 1, displayName: "Momentary Layer" } };

describe("buildKeyPresentation", () => {
  it("builds a stable key presentation with layer names computed outside the key loop", () => {
    const result = buildKeyPresentation({
      layout: layout as never,
      keymap: { layers: [{ id: 4, name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] }] } as never,
      behaviors: behaviors as never,
      selectedLayerIndex: 0,
      os: "mac",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "4-0", header: "MLayer", x: 0, y: 0 });
  });

  it("changes presentation when its keymap, behavior, layer, layout, or OS inputs change", () => {
    const input = {
      layout: layout as never,
      keymap: { layers: [{ id: 4, name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] }] } as never,
      behaviors: behaviors as never,
      selectedLayerIndex: 0,
      os: "mac" as const,
    };
    const initial = buildKeyPresentation(input);
    const changed = buildKeyPresentation({ ...input, layout: { keys: [{ x: 100, y: 0, width: 100, height: 100 }] } as never });

    expect(changed[0].x).not.toBe(initial[0].x);
  });
});
