import type { BehaviorBinding, Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { GESTURE_LAYER_INDEX } from "../keyboard/minimal-keys-layers";

export const GESTURE_DIRECTIONS = [
  { id: "up", label: "上", arrow: "↑", position: 7 },
  { id: "down", label: "下", arrow: "↓", position: 31 },
  { id: "left", label: "左", arrow: "←", position: 18 },
  { id: "right", label: "右", arrow: "→", position: 20 },
] as const;

export type GestureDirection = (typeof GESTURE_DIRECTIONS)[number]["id"];

export function getGestureBinding(
  keymap: Keymap,
  direction: GestureDirection,
): BehaviorBinding | null {
  const slot = GESTURE_DIRECTIONS.find((candidate) => candidate.id === direction);
  return slot
    ? keymap.layers[GESTURE_LAYER_INDEX]?.bindings[slot.position] ?? null
    : null;
}
