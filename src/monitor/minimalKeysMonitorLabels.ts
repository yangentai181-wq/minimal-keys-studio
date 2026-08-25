import { MINIMAL_KEYS_KEY_COUNT } from "../keyboard/minimal-keys-layout";
import {
  ALPHA_LAYOUT_KEY_LABELS,
  type AlphaLayoutId,
} from "../keyboard/alpha-layouts";

const DEFAULT_LAYER_LABELS = [
  "Q",
  "W",
  "E",
  "R",
  "T",
  "Y",
  "U",
  "I",
  "O",
  "P",
  "A",
  "S",
  "D",
  "F",
  "G",
  "MB1 / L1",
  "- / Fn",
  "H",
  "J",
  "K",
  "L",
  "Bsp",
  "Shift",
  "Z",
  "C",
  "V",
  "B",
  "Mission / L2",
  "/ / BT",
  "N",
  "M",
  ",",
  ".",
  "/",
  "Cmd",
  "Alt",
  "Ctrl",
  "Tab / Fn",
  "英数 / Sym",
  "Space / Scr",
  "Enter / Shift",
  "かな / Sym",
  "Esc",
] as const;

const TRANSPARENT = "";
const RETURN_TO_DEFAULT = "通常へ戻る";

export const MONITOR_KEY_LABELS_BY_LAYER: ReadonlyArray<ReadonlyArray<string>> = [
  DEFAULT_LAYER_LABELS,
  [
    "Cmd+N",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "7",
    "8",
    "9",
    "+",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "4",
    "5",
    "6",
    "-",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "1",
    "2",
    "3",
    "*",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "0",
    TRANSPARENT,
  ],
  [
    "Cmd+N",
    "Home",
    "PgUp",
    "PgDn",
    "End",
    "↑",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "Insert",
    "F2",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "←",
    "↓",
    "→",
    TRANSPARENT,
    "Delete",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
  ],
  [
    "Cmd+0",
    "'",
    "`",
    "<",
    ">",
    "(",
    ")",
    "=",
    "~",
    "|",
    "!",
    "\"",
    "#",
    "$",
    "%",
    "&",
    "@",
    "「",
    "」",
    ";",
    ":",
    TRANSPARENT,
    "\\",
    "?",
    "^",
    TRANSPARENT,
    "{",
    "}",
    "[",
    "]",
    "/",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "_",
    TRANSPARENT,
  ],
  [
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    "Mission",
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    "MB3",
    "MB1",
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    "MB1",
    "Scroll ↑",
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    "Mission",
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    "Scroll ↓",
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
    RETURN_TO_DEFAULT,
  ],
  [
    "Mute",
    "Prev",
    "Play",
    "Next",
    "Cmd+Shift+3",
    "Cmd+Shift+4",
    "Brightness -",
    "Brightness +",
    "Volume -",
    "Volume +",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "Caps Lock",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
  ],
  [
    "BT0",
    "BT1",
    "BT2",
    "BT3",
    "BT Clear",
    "USB",
    "BLE",
    "Toggle",
    TRANSPARENT,
    TRANSPARENT,
    "Clear",
    "Disc0",
    "Disc1",
    "Disc2",
    "Disc3",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "Boot",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    "Boot",
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
    TRANSPARENT,
  ],
  Array.from({ length: MINIMAL_KEYS_KEY_COUNT }, () => TRANSPARENT),
  Array.from({ length: MINIMAL_KEYS_KEY_COUNT }, () => TRANSPARENT),
];

export interface MonitorKeyLabel {
  label: string;
  transparent: boolean;
}

/**
 * Resolves the factory fallback table with the same active-layer mask that
 * Raw HID reports. Factory layer IDs are their L0..L8 indexes, so walk from
 * the highest-priority active layer down and only fall through empty entries.
 */
/**
 * Rewrites the tap half of a default-layer label when the keyboard runs a
 * non-QWERTY alphabet layout. The hold half (" / Fn" etc.) is preserved.
 */
export function applyAlphaLayoutToDefaultLabel(
  position: number,
  label: string,
  alphaLayout: AlphaLayoutId,
): string {
  // The factory labels already describe the QWERTY arrangement, including the
  // Shift and Backspace slots that 大西 needs for letters.
  if (alphaLayout === "qwerty") return label;

  const override = ALPHA_LAYOUT_KEY_LABELS[alphaLayout]?.[position];
  if (!override) return label;

  const [, hold] = label.split(" / ");
  return hold ? `${override} / ${hold}` : override;
}

export function resolveFactoryMonitorKeyLabel(
  position: number,
  activeLayerMask: number,
  alphaLayout: AlphaLayoutId = "qwerty",
): MonitorKeyLabel {
  for (
    let layerIndex = MONITOR_KEY_LABELS_BY_LAYER.length - 1;
    layerIndex >= 0;
    layerIndex -= 1
  ) {
    if ((activeLayerMask & (1 << layerIndex)) === 0) continue;

    const label = MONITOR_KEY_LABELS_BY_LAYER[layerIndex]?.[position];
    if (!label) continue;

    return {
      label:
        layerIndex === 0
          ? applyAlphaLayoutToDefaultLabel(position, label, alphaLayout)
          : label,
      transparent: false,
    };
  }

  return {
    label: applyAlphaLayoutToDefaultLabel(
      position,
      DEFAULT_LAYER_LABELS[position] ?? `#${position}`,
      alphaLayout,
    ),
    transparent: true,
  };
}

export function getMonitorKeyLabel(
  position: number,
  layerIndex: number,
): MonitorKeyLabel {
  const layerLabels = MONITOR_KEY_LABELS_BY_LAYER[layerIndex];
  const rawLabel = layerLabels?.[position];
  const fallback = DEFAULT_LAYER_LABELS[position] ?? `#${position}`;

  if (rawLabel) {
    return { label: rawLabel, transparent: false };
  }

  return { label: fallback, transparent: layerIndex !== 0 };
}
