import { Keyboard as KeyboardIcon } from "lucide-react";

import {
  ALPHA_LAYOUT_IDS,
  ALPHA_LAYOUT_LABELS,
  type AlphaLayoutId,
} from "./alpha-layouts";

export interface AlphaLayoutToggleProps {
  /** Layout currently on the default layer, or null when it is customised. */
  value: AlphaLayoutId | null;
  onSelect: (layoutId: AlphaLayoutId) => void;
  busy?: boolean;
  disabled?: boolean;
}

export function AlphaLayoutToggle({
  value,
  onSelect,
  busy,
  disabled,
}: AlphaLayoutToggleProps) {
  const locked = Boolean(busy || disabled);

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs font-semibold text-base-content/70">
        <KeyboardIcon className="h-3.5 w-3.5" aria-hidden="true" />
        文字配列
      </span>
      <div
        role="radiogroup"
        aria-label="文字配列"
        className="flex overflow-hidden rounded border border-base-300"
      >
        {ALPHA_LAYOUT_IDS.map((layoutId) => {
          const selected = value === layoutId;
          return (
            <button
              key={layoutId}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onSelect(layoutId)}
              className={[
                "flex-1 px-2 py-1 text-xs transition-colors disabled:opacity-40",
                selected
                  ? "bg-primary text-primary-content font-semibold"
                  : "bg-white text-base-content/70 hover:bg-base-200",
              ].join(" ")}
            >
              {ALPHA_LAYOUT_LABELS[layoutId]}
            </button>
          );
        })}
      </div>
      {value === null && (
        <span className="text-[10px] leading-tight text-base-content/60">
          カスタム配列
        </span>
      )}
      {busy && (
        <span className="text-[10px] leading-tight text-base-content/60">
          書き込み中...
        </span>
      )}
    </div>
  );
}
