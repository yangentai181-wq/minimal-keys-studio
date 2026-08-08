import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildKeyPresentation } from "./key-presentation";
import { useKeyPresentation } from "./useKeyPresentation";

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

  it("uses persistent layer IDs for layer behavior labels", () => {
    const result = buildKeyPresentation({
      layout: layout as never,
      keymap: {
        layers: [
          { id: 42, name: "Nav", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] },
          { id: 0, name: "Base", bindings: [{ behaviorId: 1, param1: 42, param2: 0 }] },
        ],
      } as never,
      behaviors: behaviors as never,
      selectedLayerIndex: 1,
      os: "mac",
    });

    expect(result[0]).toMatchObject({ header: "MLayer" });
    expect((result[0].children as { props: { children: string } }).props.children).toBe(
      "Nav",
    );
  });

  it("uses persistent layer IDs for Conditional Layer labels", () => {
    const result = buildKeyPresentation({
      layout: layout as never,
      keymap: {
        layers: [
          { id: 42, name: "Nav", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] },
          { id: 0, name: "Base", bindings: [{ behaviorId: 1, param1: 42, param2: 0 }] },
        ],
      } as never,
      behaviors: { 1: { id: 1, displayName: "Conditional Layer" } } as never,
      selectedLayerIndex: 1,
      os: "mac",
    });

    expect(result[0]).toMatchObject({ header: "Conditional" });
    expect((result[0].children as { props: { children: string } }).props.children).toBe(
      "Nav",
    );
  });

  it.each([
    ["Layer-Tap", true],
    ["LAYER_TAP_MKP", true],
    ["Mod-Tap", true],
    ["Hold-Tap", true],
    ["Key Press", false],
  ])("marks %s bindings as hold actions: %s", (displayName, hasHoldAction) => {
    const result = buildKeyPresentation({
      layout: layout as never,
      keymap: { layers: [{ id: 4, name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] }] } as never,
      behaviors: { 1: { id: 1, displayName } } as never,
      selectedLayerIndex: 0,
      os: "mac",
    });

    expect(result[0].hasHoldAction).toBe(hasHoldAction);
  });

  it("changes presentation when its keymap, behavior, layer, layout, or OS inputs change", () => {
    const input = {
      layout: layout as never,
      keymap: { layers: [{ id: 4, name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] }] } as never,
      behaviors: behaviors as never,
      selectedLayerIndex: 0,
      os: "mac" as "mac" | "windows",
    };
    const initial = buildKeyPresentation(input);
    const changed = buildKeyPresentation({ ...input, layout: { keys: [{ x: 100, y: 0, width: 100, height: 100 }] } as never });

    expect(changed[0].x).not.toBe(initial[0].x);
  });

  it("does not rebuild for selection or pixel size, but rebuilds for every selector dependency", () => {
    const base = {
      layout: layout as never,
      keymap: { layers: [{ id: 4, name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] }] } as never,
      behaviors: behaviors as never,
      selectedLayerIndex: 0,
      os: "mac" as "mac" | "windows",
      selectedPosition: 1,
      oneU: 56,
    };
    const presentationInput = (props: typeof base) => ({
      layout: props.layout,
      keymap: props.keymap,
      behaviors: props.behaviors,
      selectedLayerIndex: props.selectedLayerIndex,
      os: props.os,
    });
    const { result, rerender } = renderHook((props) => useKeyPresentation(presentationInput(props)), { initialProps: base });
    const initial = result.current;

    rerender({ ...base, selectedPosition: 2, oneU: 48 });
    expect(result.current).toBe(initial);

    const changes: Array<typeof base> = [
      { ...base, layout: { keys: [{ x: 1, y: 0, width: 100, height: 100 }] } as never },
      { ...base, keymap: { layers: [{ id: 5, name: "Base", bindings: [{ behaviorId: 1, param1: 0, param2: 0 }] }] } as never },
      { ...base, behaviors: { 1: { id: 1, displayName: "Toggle Layer" } } as never },
      { ...base, selectedLayerIndex: 1 },
      { ...base, os: "windows" },
    ];
    for (const changed of changes) {
      rerender(changed);
      expect(result.current).not.toBe(initial);
      rerender(base);
    }
  });
});
