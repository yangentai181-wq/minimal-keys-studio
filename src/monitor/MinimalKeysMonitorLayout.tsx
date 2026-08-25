import type { CSSProperties } from "react";

import { MINIMAL_KEYS_POSITIONS } from "../keyboard/minimal-keys-layout";
import { resolveFactoryMonitorKeyLabel } from "./minimalKeysMonitorLabels";
import { resolveFactoryMonitorLayerTarget } from "./monitorLayerTargets";
import type { AlphaLayoutId } from "../keyboard/alpha-layouts";
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
  activeLayerMask: number;
  pressed: ReadonlySet<number>;
  holdTapStates?: Readonly<Record<number, HoldTapDisplayState>>;
  resolvedBindings?: readonly ResolvedMonitorBinding[];
  /** Alphabet layout the keyboard is running, for factory label fallback. */
  alphaLayout?: AlphaLayoutId;
  className?: string;
}

export function MinimalKeysMonitorLayout({
  activeLayerMask,
  pressed,
  holdTapStates = {},
  resolvedBindings,
  alphaLayout = "qwerty",
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
            : resolveFactoryMonitorKeyLabel(index, activeLayerMask, alphaLayout);
          const inheritedDescription = resolvedBinding?.inherited
            ? "下位レイヤーから継承"
            : undefined;
          const descriptionId = inheritedDescription
            ? `monitor-key-description-${index}`
            : undefined;
          const isLongLabel = label.length > 4 || label.includes(" / ");
          const layerTarget = resolveFactoryMonitorLayerTarget(
            index,
            activeLayerMask,
          );
          const holdActive =
            holdTapState === "hold" || holdTapState === "hold-afterglow";
          // A layer key names its destination; the generic hold badge is
          // folded into that chip so only one badge is ever shown.
          const showDecisionBadge = Boolean(decisionLabel) && !layerTarget;

          return (
            <div
              key={position.id}
              role="gridcell"
              aria-label={`pos ${index} ${label}${isPressed ? " 押下中" : ""}${decisionLabel ? ` ${decisionLabel}` : ""}${layerTarget ? `${decisionLabel ? "" : " 長押しで"}${layerTarget.layerName}レイヤーへ` : ""}`}
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
                    (showDecisionBadge || layerTarget) && "-translate-y-1.5",
                  )}
                >
                  {label}
                </span>
                {inheritedDescription && (
                  <span id={descriptionId} className="sr-only">
                    {inheritedDescription}
                  </span>
                )}
                {showDecisionBadge && (
                  <span
                    className={cx(
                      "absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-extrabold leading-none shadow-sm",
                      holdActive
                        ? "bg-orange-500 text-white"
                        : holdTapState === "tap"
                          ? "bg-success/15 text-success"
                          : "bg-primary/15 text-primary",
                    )}
                  >
                    {decisionLabel}
                  </span>
                )}
                {layerTarget && (
                  <span
                    data-testid={`monitor-key-layer-target-${index}`}
                    className={cx(
                      "absolute bottom-1 left-1/2 max-w-[95%] -translate-x-1/2 truncate rounded px-1 py-0.5 text-[10px] font-extrabold leading-none",
                      holdActive
                        ? "bg-orange-500 text-white shadow-sm"
                        : holdTapState === "tap"
                          ? "bg-success/15 text-success"
                          : holdTapState === "pending"
                            ? "bg-primary/15 text-primary"
                            : "bg-orange-50 text-orange-600",
                    )}
                  >
                    {holdActive
                      ? `長押し → ${layerTarget.layerName}`
                      : holdTapState === "tap"
                        ? "単押し"
                        : holdTapState === "pending"
                          ? `判定中 → ${layerTarget.layerName}`
                          : `→ ${layerTarget.layerName}`}
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
