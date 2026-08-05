import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { PhysicalLayout, type BehaviorBinding, type Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { ReactNode } from "react";
import { HidUsageLabel } from "./HidUsageLabel";
import { getHidKeyDescription, getMouseKeyDescription, getMouseScrollDescription } from "./key-descriptions";
import { modifierSymbols } from "./key-label-utils";
import type { KeyPosition } from "./PhysicalLayout";
import { resolveTooltipData } from "./tooltip-data";
import { hid_usage_page_and_id_from_usage } from "../hid-usages";

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>;

export type KeyPresentationInput = {
  layout: PhysicalLayout;
  keymap: Keymap;
  behaviors: BehaviorMap;
  selectedLayerIndex: number;
  os: Parameters<typeof resolveTooltipData>[3];
};

function hidParamLabel(param: number): string {
  const [rawPage, id] = hid_usage_page_and_id_from_usage(param);
  return getHidKeyDescription(rawPage & 0xff, id).roleName;
}

function shortLayerName(index: number, names: string[]): string {
  const name = names[index];
  if (!name) return `L${index}`;
  if (name.length <= 6) return name;
  const first = name.split(/[\s&/]+/)[0];
  return first.length <= 6 ? first : first.substring(0, 5);
}

function keyDisplay(binding: BehaviorBinding, displayName: string, layerNames: string[]): { header: string; children: ReactNode } {
  switch (displayName) {
    case "Key Press": return { header: "", children: <HidUsageLabel hid_usage={binding.param1} /> };
    case "Layer-Tap": return { header: shortLayerName(binding.param1, layerNames), children: <span>{hidParamLabel(binding.param2)}</span> };
    case "LAYER_TAP_MKP": return { header: shortLayerName(binding.param1, layerNames), children: <span>{getMouseKeyDescription(binding.param2).roleName}</span> };
    case "Mod-Tap": return { header: modifierSymbols(binding.param1), children: <span>{hidParamLabel(binding.param2)}</span> };
    case "Hold-Tap": return { header: "Hold/Tap", children: <span>{hidParamLabel(binding.param2)}</span> };
    case "Momentary Layer": return { header: "MLayer", children: <span>{shortLayerName(binding.param1, layerNames)}</span> };
    case "Toggle Layer": return { header: "Toggle", children: <span>{shortLayerName(binding.param1, layerNames)}</span> };
    case "To Layer": return { header: "To", children: <span>{shortLayerName(binding.param1, layerNames)}</span> };
    case "Sticky Layer": return { header: "Sticky", children: <span>{shortLayerName(binding.param1, layerNames)}</span> };
    case "Sticky Key": return { header: "Sticky", children: <span>{modifierSymbols(binding.param1)}</span> };
    case "Mouse Key Press": return { header: "", children: <span>{getMouseKeyDescription(binding.param1).roleName}</span> };
    case "Mouse Scroll": return { header: "Scroll", children: <span>{getMouseScrollDescription(binding.param1).roleName}</span> };
    case "Bluetooth": return { header: "BT", children: <span>{binding.param1}</span> };
    case "None": return { header: "None", children: <span /> };
    case "Transparent": return { header: "Trans", children: <span /> };
    default: return { header: displayName, children: binding.param1 ? <HidUsageLabel hid_usage={binding.param1} /> : <span /> };
  }
}

/** Pure presentation selector. Selection and physical pixel size are intentionally absent. */
export function buildKeyPresentation({ layout, keymap, behaviors, selectedLayerIndex, os }: KeyPresentationInput): KeyPosition[] {
  const layer = keymap.layers[selectedLayerIndex];
  if (!layer) return [];
  const behaviorList = Object.values(behaviors);
  const layerNames = keymap.layers.map((item, index) => item.name || `L${index}`);
  return layout.keys.map((key, index) => {
    if (index >= layer.bindings.length) {
      return { id: `${layer.id}-${index}`, header: "Unknown", x: key.x / 100, y: key.y / 100, width: key.width / 100, height: key.height / 100, children: <span />, tooltipData: null };
    }
    const binding = layer.bindings[index];
    const displayName = behaviors[binding.behaviorId]?.displayName || "Unknown";
    const display = keyDisplay(binding, displayName, layerNames);
    return { id: `${layer.id}-${index}`, header: display.header, x: key.x / 100, y: key.y / 100, width: key.width / 100, height: key.height / 100, r: (key.r || 0) / 100, rx: (key.rx || 0) / 100, ry: (key.ry || 0) / 100, children: display.children, tooltipData: resolveTooltipData(binding, behaviorList, index, os) };
  });
}
