import type { CSSProperties } from "react";

import { MINIMAL_KEYS_POSITIONS } from "../keyboard/minimal-keys-layout";
import { getMonitorKeyLabel } from "./minimalKeysMonitorLabels";
import type { HoldTapDisplayState } from "./monitorStore";
import type { ResolvedMonitorBinding } from "./resolveMonitorBindings";

const layoutWidth = MINIMAL_KEYS_POSITIONS.reduce(
  (max, key) => Math.max(max, key.x + key.width),
  0,
);
const layoutHeight = MINIMAL_KEYS_POSITIONS.reduce(
  (max, key) => Math.max(max, key.y + key.height),
  0,
);

function keyStyle(position: (typeof MINIMAL_KEYS_POSITIONS)[number]): CSSProperties {
  return {
    left: `${(position.x / layoutWidth) * 100}%`,
    top: `${(position.y / layoutHeight) * 100}%`,
    width: `${(position.width / layoutWidth) * 100}%`,
    height: `${(position.height / layoutHeight) * 100}%`,
  };
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export interface MinimalKeysMonitorLayoutProps {
  activeLayerIndex: number;
  pressed: ReadonlySet<number>;
  holdTapStates?: Readonly<Record<number, HoldTapDisplayState>>;
  resolvedBindings?: readonly ResolvedMonitorBinding[];
  className?: string;
}

export function MinimalKeysMonitorLayout({
  activeLayerIndex,
  pressed,
  holdTapStates = {},
  resolvedBindings,
  className,
}: MinimalKeysMonitorLayoutProps) {
  return (
    <div
      className={cx(
        "overflow-x-auto rounded-lg border border-base-300 bg-base-200 p-3",
        className,
      )}
    >
      <div
        className="relative min-w-[680px]"
        role="grid"
        aria-label="minimal-keys 実配列モニター"
        style={{ aspectRatio: `${layoutWidth} / ${layoutHeight}` }}
      >
        <div
          className="absolute rounded-full border border-primary/20 bg-primary/5 text-[10px] font-bold text-primary"
          style={{
            left: `${(600 / layoutWidth) * 100}%`,
            top: `${(74 / layoutHeight) * 100}%`,
            width: `${(100 / layoutWidth) * 100}%`,
            height: `${(100 / layoutHeight) * 100}%`,
          }}
          aria-hidden="true"
        >
          <span className="flex h-full items-center justify-center">enc</span>
        </div>
        <div
          className="absolute rounded-full border border-accent/30 bg-orange-50 text-[10px] font-bold text-accent"
          style={{
            left: `${(930 / layoutWidth) * 100}%`,
            top: `${(292 / layoutHeight) * 100}%`,
            width: `${(160 / layoutWidth) * 100}%`,
            height: `${(92 / layoutHeight) * 100}%`,
          }}
          aria-hidden="true"
        >
          <span className="flex h-full items-center justify-center">ball</span>
        </div>

        {MINIMAL_KEYS_POSITIONS.map((position, index) => {
          const isPressed = pressed.has(index);
          const holdTapState = holdTapStates[index];
          const decisionLabel =
            holdTapState === "pending"
              ? "判定中"
              : holdTapState === "tap"
                ? "単押し"
                : holdTapState === "hold" ||
                    holdTapState === "hold-afterglow"
                  ? "長押し"
                  : null;
          const resolvedBinding = resolvedBindings?.[index];
          const { label, transparent } = resolvedBinding
            ? { label: resolvedBinding.label, transparent: false }
            : getMonitorKeyLabel(index, activeLayerIndex);
          const inheritedDescription = resolvedBinding?.inherited
            ? "下位レイヤーから継承"
            : undefined;
          const descriptionId = inheritedDescription
            ? `monitor-key-description-${index}`
            : undefined;
          const isLongLabel = label.length > 4 || label.includes(" / ");

          return (
            <div
              key={position.id}
              role="gridcell"
              aria-label={`pos ${index} ${label}${isPressed ? " 押下中" : ""}${decisionLabel ? ` ${decisionLabel}` : ""}`}
              aria-describedby={descriptionId}
              aria-pressed={isPressed}
              title={`pos ${index}: ${label}`}
              className="absolute p-0.5"
              style={keyStyle(position)}
            >
              <div
                className={cx(
                  "relative flex h-full w-full min-w-0 items-center justify-center rounded-md border px-1 text-center leading-tight shadow-sm transition",
                  holdTapState === "hold" || holdTapState === "hold-afterglow"
                    ? "border-orange-500 bg-orange-100 text-orange-950 ring-2 ring-orange-400/50"
                    : holdTapState === "tap"
                      ? "border-success bg-success/10 text-base-content ring-2 ring-success/30"
                      : holdTapState === "pending"
                        ? "border-primary bg-primary/10 text-base-content ring-2 ring-primary/30"
                        : isPressed
                    ? "border-primary bg-primary text-primary-content ring-2 ring-primary/30"
                    : transparent
                      ? "border-base-300 bg-white/60 text-base-content/35"
                      : "border-base-300 bg-white text-base-content",
                )}
              >
                <span
                  data-testid={`monitor-key-label-${index}`}
                  className={cx(
                    "line-clamp-2 break-words font-bold leading-tight",
                    isLongLabel ? "text-sm" : "text-base",
                    decisionLabel && "-translate-y-1.5",
                  )}
                >
                  {label}
                </span>
                {inheritedDescription && (
                  <span id={descriptionId} className="sr-only">
                    {inheritedDescription}
                  </span>
                )}
                {decisionLabel && (
                  <span
                    className={cx(
                      "absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-extrabold leading-none shadow-sm",
                      holdTapState === "hold" ||
                        holdTapState === "hold-afterglow"
                        ? "bg-orange-500 text-white"
                        : holdTapState === "tap"
                          ? "bg-success/15 text-success"
                          : "bg-primary/15 text-primary",
                    )}
                  >
                    {decisionLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
