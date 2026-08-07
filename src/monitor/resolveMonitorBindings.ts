import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { getNonTransparentBindingLabel } from "../keyboard/key-presentation";

export type ResolvedMonitorBinding = {
  label: string;
  sourceLayerId: number | null;
  sourceLayerIndex: number | null;
  inherited: boolean;
  unknown: boolean;
};

export type ResolvedMonitorLayer = {
  id: number;
  index: number;
};

export type ResolveMonitorBindingInput = {
  keymap: Keymap;
  behaviors: Record<number, GetBehaviorDetailsResponse>;
  activeLayerMask: number;
  position: number;
};

type ActiveMonitorLayer = ResolvedMonitorLayer & {
  bindings: Keymap["layers"][number]["bindings"];
};

function activeMonitorLayers(
  keymap: Keymap,
  activeLayerMask: number,
): ActiveMonitorLayer[] {
  const activeLayers: ActiveMonitorLayer[] = [];

  for (let index = keymap.layers.length - 1; index >= 0; index -= 1) {
    const layer = keymap.layers[index];
    if ((activeLayerMask & (1 << layer.id)) === 0) continue;
    activeLayers.push({ id: layer.id, index, bindings: layer.bindings });
  }

  return activeLayers;
}

export function resolveMonitorLayer(
  keymap: Keymap,
  activeLayerMask: number,
): ResolvedMonitorLayer | null {
  const [layer] = activeMonitorLayers(keymap, activeLayerMask);
  return layer ? { id: layer.id, index: layer.index } : null;
}

function unknownBinding(
  inherited: boolean,
  layer?: ResolvedMonitorLayer,
): ResolvedMonitorBinding {
  return {
    label: "不明",
    sourceLayerId: layer?.id ?? null,
    sourceLayerIndex: layer?.index ?? null,
    inherited,
    unknown: true,
  };
}

export function resolveMonitorBinding({
  keymap,
  behaviors,
  activeLayerMask,
  position,
}: ResolveMonitorBindingInput): ResolvedMonitorBinding {
  let inherited = false;

  for (const layer of activeMonitorLayers(keymap, activeLayerMask)) {
    const binding = layer.bindings[position];
    if (!binding) return unknownBinding(inherited, layer);

    const behavior = behaviors[binding.behaviorId];
    if (!behavior) return unknownBinding(inherited, layer);

    if (behavior.displayName === "Transparent") {
      inherited = true;
      continue;
    }

    return {
      label: getNonTransparentBindingLabel(
        binding,
        behavior.displayName,
        keymap.layers,
      ),
      sourceLayerId: layer.id,
      sourceLayerIndex: layer.index,
      inherited,
      unknown: false,
    };
  }

  return unknownBinding(inherited);
}
