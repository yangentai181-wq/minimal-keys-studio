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

export type HoldTapDisplayState =
  | "pending"
  | "tap"
  | "hold"
  | "hold-afterglow";

export type MonitorSnapshot = {
  pressed: ReadonlySet<number>;
  defaultLayer: number;
  activeLayerMask: number;
  /** Highest active layer, i.e. the layer resolving key presses right now. */
  activeLayerIndex: number;
  pointer: PointerSample | null;
  encoders: Readonly<Record<number, EncoderSample>>;
  holdTapStates: Readonly<Record<number, HoldTapDisplayState>>;
  lastEventAt: number | null;
};

export const initialMonitorSnapshot: MonitorSnapshot = {
  pressed: new Set(),
  defaultLayer: 0,
  activeLayerMask: 1,
  activeLayerIndex: 0,
  pointer: null,
  encoders: {},
  holdTapStates: {},
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
    case "holdTap": {
      const holdTapStates = { ...snapshot.holdTapStates };
      if (frame.phase === "released") {
        delete holdTapStates[frame.position];
      } else {
        holdTapStates[frame.position] = frame.phase;
      }
      return { ...snapshot, holdTapStates, lastEventAt: at };
    }
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
  const holdTapCleanupTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

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

  const cancelHoldTapCleanup = (position: number) => {
    const timer = holdTapCleanupTimers.get(position);
    if (timer !== undefined) {
      clearTimeout(timer);
      holdTapCleanupTimers.delete(position);
    }
  };

  const scheduleHoldTapCleanup = (
    position: number,
    expected: HoldTapDisplayState,
    delay: number,
  ) => {
    cancelHoldTapCleanup(position);
    const timer = setTimeout(() => {
      holdTapCleanupTimers.delete(position);
      if (snapshot.holdTapStates[position] !== expected) return;
      const holdTapStates = { ...snapshot.holdTapStates };
      delete holdTapStates[position];
      snapshot = { ...snapshot, holdTapStates };
      notifyImmediately();
    }, delay);
    holdTapCleanupTimers.set(position, timer);
  };

  const pushHoldTapFrame = (
    frame: Extract<RawHidFrame, { kind: "holdTap" }>,
    at: number,
  ) => {
    const current = snapshot.holdTapStates[frame.position];

    if (frame.phase === "released") {
      if (current === "hold") {
        cancelHoldTapCleanup(frame.position);
        snapshot = {
          ...snapshot,
          holdTapStates: {
            ...snapshot.holdTapStates,
            [frame.position]: "hold-afterglow",
          },
          lastEventAt: at,
        };
        scheduleHoldTapCleanup(frame.position, "hold-afterglow", 250);
      } else if (current === "tap") {
        snapshot = { ...snapshot, lastEventAt: at };
        scheduleHoldTapCleanup(frame.position, "tap", 400);
      } else {
        cancelHoldTapCleanup(frame.position);
        snapshot = applyFrame(snapshot, frame, at);
      }
      return;
    }

    cancelHoldTapCleanup(frame.position);
    snapshot = applyFrame(snapshot, frame, at);
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: (frame, at = Date.now()) => {
      if (frame.kind === "holdTap") {
        pushHoldTapFrame(frame, at);
      } else {
        snapshot = applyFrame(snapshot, frame, at);
      }
      if (frame.kind === "pointer") {
        notifyPointerFrame();
      } else {
        notifyImmediately();
      }
    },
    reset: () => {
      for (const timer of holdTapCleanupTimers.values()) {
        clearTimeout(timer);
      }
      holdTapCleanupTimers.clear();
      snapshot = initialMonitorSnapshot;
      notifyImmediately();
    },
  };
}
