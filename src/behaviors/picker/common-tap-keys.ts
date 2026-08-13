import { hid_usage_from_page_and_id } from "../../hid-usages";
import type { UserOS } from "../use-cases";

// Shared tap key list for Layer-Tap and Mod-Tap param2 selection.
export interface TapKeyItem {
  label: string;
  hidId: number;
  modifier?: number;
}

const shift = 0x02;

const letters = Array.from({ length: 26 }, (_, index) => ({
  label: String.fromCharCode(65 + index),
  hidId: 4 + index,
}));

const numbers = [
  ...Array.from({ length: 9 }, (_, index) => ({
    label: String(index + 1),
    hidId: 30 + index,
  })),
  { label: "0", hidId: 39 },
];

const functionKeys = [
  ...Array.from({ length: 12 }, (_, index) => ({
    label: `F${index + 1}`,
    hidId: 58 + index,
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    label: `F${index + 13}`,
    hidId: 104 + index,
  })),
];

const symbols: TapKeyItem[] = [
  { label: "-", hidId: 45 },
  { label: "=", hidId: 46 },
  { label: "[", hidId: 47 },
  { label: "]", hidId: 48 },
  { label: "\\", hidId: 49 },
  { label: ";", hidId: 51 },
  { label: "'", hidId: 52 },
  { label: "`", hidId: 53 },
  { label: ",", hidId: 54 },
  { label: ".", hidId: 55 },
  { label: "/", hidId: 56 },
  { label: "!", hidId: 30, modifier: shift },
  { label: "@", hidId: 31, modifier: shift },
  { label: "#", hidId: 32, modifier: shift },
  { label: "$", hidId: 33, modifier: shift },
  { label: "%", hidId: 34, modifier: shift },
  { label: "^", hidId: 35, modifier: shift },
  { label: "&", hidId: 36, modifier: shift },
  { label: "*", hidId: 37, modifier: shift },
  { label: "(", hidId: 38, modifier: shift },
  { label: ")", hidId: 39, modifier: shift },
  { label: "_", hidId: 45, modifier: shift },
  { label: "+", hidId: 46, modifier: shift },
  { label: "{", hidId: 47, modifier: shift },
  { label: "}", hidId: 48, modifier: shift },
  { label: "|", hidId: 49, modifier: shift },
  { label: ":", hidId: 51, modifier: shift },
  { label: '"', hidId: 52, modifier: shift },
  { label: "~", hidId: 53, modifier: shift },
  { label: "<", hidId: 54, modifier: shift },
  { label: ">", hidId: 55, modifier: shift },
  { label: "?", hidId: 56, modifier: shift },
];

const commonKeys: TapKeyItem[] = [
  { label: "Space", hidId: 44 },
  { label: "Enter", hidId: 40 },
  { label: "Tab", hidId: 43 },
  { label: "Esc", hidId: 41 },
  { label: "BS", hidId: 42 },
  { label: "Delete", hidId: 76 },
  { label: "Caps Lock", hidId: 57 },
  { label: "Insert", hidId: 73 },
  { label: "PrtSc", hidId: 70 },
  { label: "Scroll Lock", hidId: 71 },
  { label: "Pause", hidId: 72 },
  { label: "Menu", hidId: 101 },
  { label: "←", hidId: 80 },
  { label: "↓", hidId: 81 },
  { label: "↑", hidId: 82 },
  { label: "→", hidId: 79 },
  { label: "Home", hidId: 74 },
  { label: "End", hidId: 77 },
  { label: "Page Up", hidId: 75 },
  { label: "Page Down", hidId: 78 },
];

export function getCommonTapKeys(osMode: UserOS): TapKeyItem[] {
  const isMac = osMode === "mac";

  return [
    ...commonKeys,
    ...letters,
    ...numbers,
    ...functionKeys,
    ...symbols,
    { label: "Ctrl (左)", hidId: 224 },
    { label: "Shift (左)", hidId: 225 },
    { label: isMac ? "Option (左)" : "Alt (左)", hidId: 226 },
    { label: isMac ? "Cmd (左)" : "Win (左)", hidId: 227 },
    { label: "Ctrl (右)", hidId: 228 },
    { label: "Shift (右)", hidId: 229 },
    { label: isMac ? "Option (右)" : "Alt (右)", hidId: 230 },
    { label: isMac ? "Cmd (右)" : "Win (右)", hidId: 231 },
    { label: "ABC", hidId: isMac ? 145 : 139 },
    { label: "あいう", hidId: isMac ? 144 : 138 },
  ];
}

export function encodeTapKey(item: TapKeyItem): number {
  const usage = hid_usage_from_page_and_id(7, item.hidId);
  return item.modifier === undefined ? usage : (item.modifier << 24) | usage;
}

// Compatibility export while consumers migrate to the OS-aware getter.
export const commonTapKeys = getCommonTapKeys("mac");
