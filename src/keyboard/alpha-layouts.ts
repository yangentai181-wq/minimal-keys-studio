// L0 alphabet arrangements the user can toggle between.
//
// The board exposes the full 30-key alpha block (3 rows x 5 columns per hand);
// the factory keymap simply parks Shift and Backspace in two of those slots
// instead of letters:
//
//   通常（QWERTY）      Q W E R T | Y U I O P      大西            Q L U , . | F W R Y P
//                      A S D F G | H J K L Bsp                    E I A O - | K T N S H
//                      Z X C V B | N M , . /                      Z X C V ; | G D M J B
//
// 大西 needs the右小指ホーム slot for H, so Backspace moves to the right centre
// key (position 16), whose L5 hold is preserved. Switching back restores the
// bindings that were displaced, so a customised Shift/Backspace survives the
// round trip.

import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";

import { hid_usage_from_page_and_id } from "../hid-usages";

export type AlphaLayoutId = "qwerty" | "oonishi";

export const ALPHA_LAYOUT_IDS: readonly AlphaLayoutId[] = ["qwerty", "oonishi"];

export const ALPHA_LAYOUT_LABELS: Record<AlphaLayoutId, string> = {
  qwerty: "通常配列",
  oonishi: "大西配列",
};

const KEYBOARD_USAGE_PAGE = 0x07;

const NAMED_USAGE_IDS: Record<string, number> = {
  "-": 0x2d,
  ";": 0x33,
  ",": 0x36,
  ".": 0x37,
  "/": 0x38,
  bspc: 0x2a,
};

function usageId(key: string): number {
  const named = NAMED_USAGE_IDS[key];
  if (named !== undefined) return named;
  return 0x04 + (key.charCodeAt(0) - "a".charCodeAt(0));
}

// Physical positions of the alpha block, in the row order shown above.
// 15 / 27 / 28 are centre keys and 34-42 are thumbs: both stay untouched.
const ALPHA_POSITIONS: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 29, 30, 31, 32, 33,
];

const ALPHA_LAYOUT_KEY_NAMES: Record<AlphaLayoutId, readonly string[]> = {
  qwerty: [
    "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
    "a", "s", "d", "f", "g", "-", "h", "j", "k", "l", "bspc",
    "z", "x", "c", "v", "b", "n", "m", ",", ".", "/",
  ],
  oonishi: [
    "q", "l", "u", ",", ".", "f", "w", "r", "y", "p",
    "e", "i", "a", "o", "-", "bspc", "k", "t", "n", "s", "h",
    "z", "x", "c", "v", ";", "g", "d", "m", "j", "b",
  ],
};

function buildKeyTable(layoutId: AlphaLayoutId): Record<number, number> {
  const names = ALPHA_LAYOUT_KEY_NAMES[layoutId];
  const table: Record<number, number> = {};
  ALPHA_POSITIONS.forEach((position, index) => {
    table[position] = usageId(names[index]);
  });
  return table;
}

/** position -> HID keyboard usage id, per layout. */
export const ALPHA_LAYOUT_KEYS: Record<
  AlphaLayoutId,
  Readonly<Record<number, number>>
> = {
  qwerty: buildKeyTable("qwerty"),
  oonishi: buildKeyTable("oonishi"),
};

function buildLabelTable(layoutId: AlphaLayoutId): Record<number, string> {
  const names = ALPHA_LAYOUT_KEY_NAMES[layoutId];
  const table: Record<number, string> = {};
  ALPHA_POSITIONS.forEach((position, index) => {
    const name = names[index];
    table[position] = name === "bspc" ? "Bsp" : name.toUpperCase();
  });
  return table;
}

/** position -> label shown on the key, per layout. */
export const ALPHA_LAYOUT_KEY_LABELS: Record<
  AlphaLayoutId,
  Readonly<Record<number, string>>
> = {
  qwerty: buildLabelTable("qwerty"),
  oonishi: buildLabelTable("oonishi"),
};

const STORAGE_KEY = "minimal-keys-studio.alphaLayout";
const SNAPSHOTS_KEY = "minimal-keys-studio.alphaSnapshots";

function isAlphaLayoutId(value: unknown): value is AlphaLayoutId {
  return ALPHA_LAYOUT_IDS.includes(value as AlphaLayoutId);
}

/**
 * Last layout written to the keyboard. Monitor-only mode has no keymap to read,
 * so the factory labels lean on this to stay truthful after a switch.
 */
export function readStoredAlphaLayout(): AlphaLayoutId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isAlphaLayoutId(stored)) return stored;
  } catch {
    // Storage unavailable (private mode, tests): fall back to the factory layout.
  }
  return "qwerty";
}

type AlphaSnapshots = Partial<
  Record<AlphaLayoutId, Record<number, BehaviorBinding>>
>;

/**
 * Per-layout memory of the alpha block, so switching away and back keeps the
 * keys the user customised while that layout was active (and keeps a moved
 * Shift or Backspace when returning to the factory arrangement).
 */
export function readAlphaSnapshots(): AlphaSnapshots {
  try {
    const stored = localStorage.getItem(SNAPSHOTS_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AlphaSnapshots;
  } catch {
    return {};
  }
}

export function readAlphaLayoutSnapshot(
  layoutId: AlphaLayoutId,
): Record<number, BehaviorBinding> | null {
  return readAlphaSnapshots()[layoutId] ?? null;
}

export function storeAlphaSnapshot(
  layoutId: AlphaLayoutId,
  bindings: Record<number, BehaviorBinding>,
): void {
  try {
    const snapshots = readAlphaSnapshots();
    snapshots[layoutId] = bindings;
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch {
    // Persisting the snapshot is best effort only.
  }
}

/** The alpha-block bindings of a layer, keyed by position. */
export function snapshotAlphaBlock(
  bindings: readonly BehaviorBinding[],
): Record<number, BehaviorBinding> {
  const snapshot: Record<number, BehaviorBinding> = {};
  for (const position of ALPHA_POSITIONS) {
    const binding = bindings[position];
    if (binding) snapshot[position] = { ...binding };
  }
  return snapshot;
}

export function storeAlphaLayout(layoutId: AlphaLayoutId): void {
  try {
    localStorage.setItem(STORAGE_KEY, layoutId);
  } catch {
    // Persisting the preference is best effort only.
  }
}

export interface AlphaLayoutChange {
  keyPosition: number;
  binding: BehaviorBinding;
}

export type AlphaLayoutChangeResult =
  | { ok: true; changes: AlphaLayoutChange[] }
  | { ok: false; error: "missing-key-press-behavior" };

const HOLD_TAP_BEHAVIORS = ["Layer-Tap", "Mod-Tap", "Hold-Tap"];

function behaviorName(
  binding: BehaviorBinding | undefined,
  behaviors: Record<number, GetBehaviorDetailsResponse>,
): string | undefined {
  if (!binding) return undefined;
  return behaviors[binding.behaviorId]?.displayName;
}

/** The key code a binding sends on tap, or null when it sends none. */
function tapUsage(
  binding: BehaviorBinding | undefined,
  behaviors: Record<number, GetBehaviorDetailsResponse>,
): number | null {
  const name = behaviorName(binding, behaviors);
  if (!binding || !name) return null;
  if (name === "Key Press") return binding.param1;
  if (HOLD_TAP_BEHAVIORS.includes(name)) return binding.param2;
  return null;
}

/**
 * Bindings needed to put `layoutId` on the given layer. Only positions that
 * actually differ are returned, so re-applying the current layout is a no-op.
 * Hold-tap keys keep their hold half and only swap the tapped key code.
 */
export function buildAlphaLayoutChanges(
  bindings: readonly BehaviorBinding[],
  behaviors: Record<number, GetBehaviorDetailsResponse>,
  layoutId: AlphaLayoutId,
  restore?: Record<number, BehaviorBinding> | null,
): AlphaLayoutChangeResult {
  const keyPress = Object.values(behaviors).find(
    (behavior) => behavior.displayName === "Key Press",
  );
  if (!keyPress) return { ok: false, error: "missing-key-press-behavior" };

  const changes: AlphaLayoutChange[] = [];

  for (const [position, id] of Object.entries(ALPHA_LAYOUT_KEYS[layoutId])) {
    const keyPosition = Number(position);
    const current = bindings[keyPosition];
    if (!current) continue;

    const usage = hid_usage_from_page_and_id(KEYBOARD_USAGE_PAGE, id);
    const name = behaviorName(current, behaviors);
    const restored = restore?.[keyPosition];
    const binding: BehaviorBinding = restored
      ? restored
      : HOLD_TAP_BEHAVIORS.includes(name ?? "")
        ? { ...current, param2: usage }
        : { behaviorId: keyPress.id, param1: usage, param2: 0 };

    if (
      binding.behaviorId === current.behaviorId &&
      binding.param1 === current.param1 &&
      binding.param2 === current.param2
    ) {
      continue;
    }

    changes.push({ keyPosition, binding });
  }

  return { ok: true, changes };
}

function layoutMatchScore(
  bindings: readonly BehaviorBinding[],
  behaviors: Record<number, GetBehaviorDetailsResponse>,
  layoutId: AlphaLayoutId,
): number {
  let score = 0;
  for (const [position, id] of Object.entries(ALPHA_LAYOUT_KEYS[layoutId])) {
    const expected = hid_usage_from_page_and_id(KEYBOARD_USAGE_PAGE, id);
    if (tapUsage(bindings[Number(position)], behaviors) === expected) score += 1;
  }
  return score;
}

/**
 * The layout the layer is closest to, by how many alpha slots match. Unlike
 * `detectAlphaLayout` this always commits to a direction, so a hand-customised
 * block still switches the right way without any stored state.
 */
export function resolveCurrentAlphaLayout(
  bindings: readonly BehaviorBinding[],
  behaviors: Record<number, GetBehaviorDetailsResponse>,
): AlphaLayoutId {
  let best: AlphaLayoutId = "qwerty";
  let bestScore = -1;
  for (const layoutId of ALPHA_LAYOUT_IDS) {
    const score = layoutMatchScore(bindings, behaviors, layoutId);
    if (score > bestScore) {
      best = layoutId;
      bestScore = score;
    }
  }
  return best;
}

/** Which known layout the layer currently uses, or null when it is custom. */
export function detectAlphaLayout(
  bindings: readonly BehaviorBinding[],
  behaviors: Record<number, GetBehaviorDetailsResponse>,
): AlphaLayoutId | null {
  for (const layoutId of ALPHA_LAYOUT_IDS) {
    const matches = Object.entries(ALPHA_LAYOUT_KEYS[layoutId]).every(
      ([position, id]) =>
        tapUsage(bindings[Number(position)], behaviors) ===
        hid_usage_from_page_and_id(KEYBOARD_USAGE_PAGE, id),
    );
    if (matches) return layoutId;
  }

  return null;
}
