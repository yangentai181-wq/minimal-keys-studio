import {
  CSSProperties,
  PropsWithChildren,
} from "react";
import { Key } from "./Key";
import { ENCODER_POSITION } from "./key-descriptions";

export type KeyPosition = PropsWithChildren<{
  id: string;
  header?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  r?: number;
  rx?: number;
  ry?: number;
  hasHoldAction?: boolean;
  tooltipData?: import("./tooltip-data").TooltipData | null;
}>;

export type LayoutZoom = number | "auto";

export interface PhysicalLayoutPositionState {
  selected?: boolean;
  disabled?: boolean;
  describedBy?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function deserializeLayoutZoom(value: string): LayoutZoom {
  if (value === "auto") {
    return "auto";
  }
  return parseFloat(value) || "auto";
}

interface PhysicalLayoutProps {
  positions: Array<KeyPosition>;
  selectedPosition?: number;
  oneU?: number;
  onPositionClicked?: (position: number) => void;
  encoderRotationLabel?: string;
  positionStates?: Record<number, PhysicalLayoutPositionState>;
}

interface PhysicalLayoutPositionLocation {
  x: number;
  y: number;
  r?: number;
  rx?: number;
  ry?: number;
}

function scalePosition(
  { x, y, r, rx, ry }: PhysicalLayoutPositionLocation,
  oneU: number,
): CSSProperties {
  const left = x * oneU;
  const top = y * oneU;
  let transformOrigin = undefined;
  let transform = undefined;

  if (r) {
    const transformX = ((rx || x) - x) * oneU;
    const transformY = ((ry || y) - y) * oneU;
    transformOrigin = `${transformX}px ${transformY}px`;
    transform = `rotate(${r}deg)`;
  }

  return {
    top,
    left,
    transformOrigin,
    transform,
  };
}

// Pure rendering component — no container measurement, no ResizeObserver.
// oneU is computed by the parent and passed as a prop.
export const PhysicalLayout = ({
  positions,
  selectedPosition,
  oneU = 56,
  onPositionClicked,
  encoderRotationLabel,
  positionStates,
}: PhysicalLayoutProps) => {
  const rightMost = positions
    .map((k) => k.x + k.width)
    .reduce((a, b) => Math.max(a, b), 0);
  const bottomMost = positions
    .map((k) => k.y + k.height)
    .reduce((a, b) => Math.max(a, b), 0);

  const positionItems = positions.map((p, idx) => {
    const state = positionStates?.[idx];
    const selected = state?.selected ?? idx === selectedPosition;
    const disabled = state?.disabled ?? false;
    return (
    <div className="absolute" key={p.id} style={scalePosition(p, oneU)}>
      <div
        onClick={() => !disabled && onPositionClicked?.(idx)}
        className="hover:[transform:translateZ(100px)] transition-transform duration-200"
      >
        <Key
          oneU={oneU}
          selected={selected}
          disabled={disabled}
          describedBy={state?.describedBy}
          tooltipData={p.tooltipData}
          encoderRotationLabel={idx === ENCODER_POSITION ? encoderRotationLabel : undefined}
          {...p}
        />
      </div>
    </div>
    );
  });

  return (
    <div
      className="relative"
      style={{
        width: rightMost * oneU + "px",
        height: bottomMost * oneU + "px",
      }}
    >
      {positionItems}
    </div>
  );
};
