import { commonTapKeys, type TapKeyItem } from "./common-tap-keys";

interface TapKeySelectProps {
  selected: TapKeyItem | null;
  onChange: (item: TapKeyItem) => void;
}

function selectedIndex(selected: TapKeyItem | null): string {
  if (!selected) return "";
  const index = commonTapKeys.findIndex(
    (item) =>
      item.hidId === selected.hidId && item.modifier === selected.modifier,
  );
  return index < 0 ? "" : String(index);
}

export function TapKeySelect({ selected, onChange }: TapKeySelectProps) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs text-base-content/60">
        タップキーを選択
      </span>
      <select
        aria-label="タップキーを選択"
        className="h-9 w-full rounded-md border border-base-300 bg-white px-2 text-sm text-base-content"
        value={selectedIndex(selected)}
        onChange={(event) => {
          if (event.target.value === "") return;
          const item = commonTapKeys[Number(event.target.value)];
          if (item) onChange(item);
        }}
      >
        <option value="">選択してください</option>
        {commonTapKeys.map((item, index) => (
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
