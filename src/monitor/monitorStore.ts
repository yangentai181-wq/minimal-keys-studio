// Framework-free store that folds Raw HID frames into a monitor snapshot.
// React consumes it via useSyncExternalStore (see useRawHidMonitor.ts).

import {
  highestActiveLayer,
  type RawHidFrame,
} from "../connection/rawHidFrames";

export type PointerSample = {
  dx: number;
  dy: number;
  wheel: number;
  hwheel: number;
  buttons: number;
  at: number;
};

export type EncoderSample = {
  delta: number;
  at: number;
};

export type MonitorSnapshot = {
  pressed: ReadonlySet<number>;
  defaultLayer: number;
  activeLayerMask: number;
  /** Highest active layer, i.e. the layer resolving key presses right now. */
  activeLayerIndex: number;
  pointer: PointerSample | null;
  encoders: Readonly<Record<number, EncoderSample>>;
  lastEventAt: number | null;
};

export const initialMonitorSnapshot: MonitorSnapshot = {
  pressed: new Set(),
  defaultLayer: 0,
  activeLayerMask: 1,
  activeLayerIndex: 0,
  pointer: null,
  encoders: {},
  lastEventAt: null,
};

export function applyFrame(
  snapshot: MonitorSnapshot,
  frame: RawHidFrame,
  at: number,
): MonitorSnapshot {
  switch (frame.kind) {
    case "key": {
      const pressed = new Set(snapshot.pressed);
      if (frame.pressed) {
        pressed.add(frame.position);
      } else {
        pressed.delete(frame.position);
      }
      return { ...snapshot, pressed, lastEventAt: at };
    }
    case "layer":
      return {
        ...snapshot,
        defaultLayer: frame.defaultLayer,
        activeLayerMask: frame.activeLayerMask,
        activeLayerIndex: highestActiveLayer(
          frame.activeLayerMask,
          frame.defaultLayer,
        ),
        lastEventAt: at,
      };
    case "pointer":
      return {
        ...snapshot,
        pointer: {
          dx: frame.dx,
          dy: frame.dy,
          wheel: frame.wheel,
          hwheel: frame.hwheel,
          buttons: frame.buttons,
          at,
        },
        lastEventAt: at,
      };
    case "encoder":
      return {
        ...snapshot,
        encoders: {
          ...snapshot.encoders,
          [frame.sensor]: { delta: frame.delta, at },
        },
        lastEventAt: at,
      };
  }
}

export type MonitorStore = {
  getSnapshot: () => MonitorSnapshot;
  subscribe: (listener: () => void) => () => void;
  push: (frame: RawHidFrame, at?: number) => void;
  reset: () => void;
};

export type PointerNotifyScheduler = (notify: () => void) => () => void;

const schedulePointerNotify: PointerNotifyScheduler = (notify) => {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(notify);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(notify, 16);
  return () => clearTimeout(id);
};

export function createMonitorStore(
  schedule: PointerNotifyScheduler = schedulePointerNotify,
): MonitorStore {
  let snapshot = initialMonitorSnapshot;
  const listeners = new Set<() => void>();
  let cancelPendingPointerNotify: (() => void) | null = null;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const notifyPointerFrame = () => {
    if (cancelPendingPointerNotify) return;
    cancelPendingPointerNotify = schedule(() => {
      cancelPendingPointerNotify = null;
      notify();
    });
  };

  const notifyImmediately = () => {
    cancelPendingPointerNotify?.();
    cancelPendingPointerNotify = null;
    notify();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: (frame, at = Date.now()) => {
      snapshot = applyFrame(snapshot, frame, at);
      if (frame.kind === "pointer") {
        notifyPointerFrame();
      } else {
        notifyImmediately();
      }
    },
    reset: () => {
      snapshot = initialMonitorSnapshot;
      notifyImmediately();
    },
  };
}
