import { describe, expect, it } from "vitest";
import { encodeTapKey, getCommonTapKeys, type TapKeyItem } from "./common-tap-keys";

function findKey(items: TapKeyItem[], label: string): TapKeyItem {
  const item = items.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Missing tap key: ${label}`);
  return item;
}

describe("getCommonTapKeys", () => {
  it("uses macOS Japanese IME and modifier labels", () => {
    const items = getCommonTapKeys("mac");

    expect(findKey(items, "ABC")).toMatchObject({ hidId: 145 });
    expect(findKey(items, "あいう")).toMatchObject({ hidId: 144 });
    expect(findKey(items, "Option (左)")).toMatchObject({ hidId: 226 });
    expect(findKey(items, "Cmd (左)")).toMatchObject({ hidId: 227 });
    expect(findKey(items, "Option (右)")).toMatchObject({ hidId: 230 });
    expect(findKey(items, "Cmd (右)")).toMatchObject({ hidId: 231 });
  });

  it("uses Windows Japanese IME and modifier labels", () => {
    const items = getCommonTapKeys("windows");

    expect(findKey(items, "ABC")).toMatchObject({ hidId: 139 });
    expect(findKey(items, "あいう")).toMatchObject({ hidId: 138 });
    expect(findKey(items, "Alt (左)")).toMatchObject({ hidId: 226 });
    expect(findKey(items, "Win (左)")).toMatchObject({ hidId: 227 });
    expect(findKey(items, "Alt (右)")).toMatchObject({ hidId: 230 });
    expect(findKey(items, "Win (右)")).toMatchObject({ hidId: 231 });
  });

  it("includes navigation, all function keys, common system keys, and symbols", () => {
    const items = getCommonTapKeys("mac");

    expect(findKey(items, "←")).toMatchObject({ hidId: 80 });
    expect(findKey(items, "↓")).toMatchObject({ hidId: 81 });
    expect(findKey(items, "↑")).toMatchObject({ hidId: 82 });
    expect(findKey(items, "→")).toMatchObject({ hidId: 79 });
    expect(findKey(items, "Home")).toMatchObject({ hidId: 74 });
    expect(findKey(items, "End")).toMatchObject({ hidId: 77 });
    expect(findKey(items, "Page Up")).toMatchObject({ hidId: 75 });
    expect(findKey(items, "Page Down")).toMatchObject({ hidId: 78 });
    expect(findKey(items, "F1")).toMatchObject({ hidId: 58 });
    expect(findKey(items, "F12")).toMatchObject({ hidId: 69 });
    expect(findKey(items, "F13")).toMatchObject({ hidId: 104 });
    expect(findKey(items, "F24")).toMatchObject({ hidId: 115 });
    expect(findKey(items, "Caps Lock")).toMatchObject({ hidId: 57 });
    expect(findKey(items, "PrtSc")).toMatchObject({ hidId: 70 });
    expect(findKey(items, "?")).toMatchObject({ hidId: 56, modifier: 0x02 });
  });

  it("encodes the keyboard HID usage with its optional modifier and has no duplicates", () => {
    const items = getCommonTapKeys("windows");

    expect(encodeTapKey({ label: "Space", hidId: 44 })).toBe(0x0007002c);
    expect(encodeTapKey({ label: "!", hidId: 30, modifier: 0x02 })).toBe(0x0207001e);
    expect(new Set(items.map(encodeTapKey)).size).toBe(items.length);
  });
});
