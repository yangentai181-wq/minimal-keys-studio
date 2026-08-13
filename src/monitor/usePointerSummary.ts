import { useEffect, useState } from "react";

import {
  POINTER_DISPLAY_TIMEOUT_MS,
  type PointerSample,
} from "./monitorStore";

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function formatPointerMovement(pointer: PointerSample) {
  return `dx ${signed(pointer.dx)} / dy ${signed(pointer.dy)}`;
}

export function usePointerSummary(
  pointer: PointerSample | null,
  format = formatPointerMovement,
) {
  const [now, setNow] = useState(() => Date.now());
  const pointerAt = pointer?.at;

  useEffect(() => {
    if (pointerAt === undefined) return;
    setNow(Date.now());
    const delay = Math.max(0, pointerAt + POINTER_DISPLAY_TIMEOUT_MS - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [pointerAt]);

  if (pointer === null || now - pointer.at >= POINTER_DISPLAY_TIMEOUT_MS) {
    return "停止中";
  }

  return format(pointer);
}
