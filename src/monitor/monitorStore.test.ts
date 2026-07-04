import { describe, expect, it } from "vitest";

import { applyFrame, createMonitorStore, initialMonitorSnapshot } from "./monitorStore";

describe("applyFrame", () => {
  it("tracks pressed keys per position", () => {
    let snapshot = initialMonitorSnapshot;
    snapshot = applyFrame(
      snapshot,
      { kind: "key", position: 3, pressed: true },
      100,
    );
    snapshot = applyFrame(
      snapshot,
      { kind: "key", position: 7, pressed: true },
      110,
    );
    snapshot = applyFrame(
      snapshot,
      { kind: "key", position: 3, pressed: false },
      120,
    );
    expect([...snapshot.pressed]).toEqual([7]);
    expect(snapshot.lastEventAt).toBe(120);
  });

  it("follows layer frames and resolves the highest active layer", () => {
    const snapshot = applyFrame(
      initialMonitorSnapshot,
      { kind: "layer", defaultLayer: 0, activeLayerMask: 0b10001 },
      100,
    );
    expect(snapshot.activeLayerIndex).toBe(4);
    expect(snapshot.activeLayerMask).toBe(0b10001);
  });

  it("keeps pointer and encoder samples", () => {
    let snapshot = applyFrame(
      initialMonitorSnapshot,
      { kind: "pointer", dx: 5, dy: -2, wheel: 0, hwheel: 0, buttons: 1 },
      100,
    );
    snapshot = applyFrame(
      snapshot,
      { kind: "encoder", sensor: 0, delta: -1 },
      110,
    );
    expect(snapshot.pointer).toMatchObject({ dx: 5, dy: -2, buttons: 1 });
    expect(snapshot.encoders[0]).toMatchObject({ delta: -1 });
  });
});

describe("createMonitorStore", () => {
  it("notifies subscribers and exposes immutable snapshots", () => {
    const store = createMonitorStore();
    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });

    const before = store.getSnapshot();
    store.push({ kind: "key", position: 1, pressed: true }, 100);

    expect(notified).toBe(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().pressed.has(1)).toBe(true);

    store.reset();
    expect(store.getSnapshot().pressed.size).toBe(0);
    unsubscribe();
  });
});
