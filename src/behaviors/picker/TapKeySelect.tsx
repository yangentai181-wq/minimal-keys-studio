import { encodeTapKey, getCommonTapKeys, type TapKeyItem } from "./common-tap-keys";
import type { UserOS } from "../use-cases";

interface TapKeySelectProps {
  osMode: UserOS;
  selected: TapKeyItem | null;
  currentExternal?: TapKeyItem;
  onChange: (item: TapKeyItem) => void;
}

function sameTapKey(a: TapKeyItem, b: TapKeyItem): boolean {
  return encodeTapKey(a) === encodeTapKey(b);
}

function selectedIndex(selected: TapKeyItem | null, items: TapKeyItem[]): string {
  if (!selected) return "";
  const index = items.findIndex((item) => sameTapKey(item, selected));
  return index < 0 ? "" : String(index);
}

export function TapKeySelect({
  osMode,
  selected,
  currentExternal,
  onChange,
}: TapKeySelectProps) {
  const catalog = getCommonTapKeys(osMode);
  const items =
    currentExternal && !catalog.some((item) => sameTapKey(item, currentExternal))
      ? [currentExternal, ...catalog]
      : catalog;
  const displayedSelection = selected ?? currentExternal ?? null;

  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs text-base-content/60">
        タップキーを選択
      </span>
      <select
        aria-label="タップキーを選択"
        className="h-9 w-full rounded-md border border-base-300 bg-white px-2 text-sm text-base-content"
        value={selectedIndex(displayedSelection, items)}
        onChange={(event) => {
          if (event.target.value === "") return;
          const item = items[Number(event.target.value)];
          if (item) onChange(item);
        }}
      >
        <option value="">選択してください</option>
        {items.map((item, index) => (
          <option
            key={`${item.hidId}:${item.modifier ?? 0}`}
            value={index}
          >
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
