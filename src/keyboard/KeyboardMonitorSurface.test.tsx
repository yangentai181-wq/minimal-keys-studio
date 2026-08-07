import { render, screen } from "@testing-library/react";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { describe, expect, it, vi } from "vitest";

import { createMonitorStore, type MonitorStore } from "../monitor/monitorStore";
import { KeyboardMonitorSurface } from "./KeyboardMonitorSurface";
import {
  MonitorKeymapProvider,
  usePublishMonitorKeymap,
} from "./MonitorKeymapContext";

const { behaviorMap } = vi.hoisted(() => ({
  behaviorMap: {
    1: { id: 1, displayName: "Key Press", metadata: [] },
    2: { id: 2, displayName: "To Layer", metadata: [] },
    3: { id: 3, displayName: "Transparent", metadata: [] },
  },
}));

vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorMap: () => behaviorMap,
}));

function keymapWithL4ReturnBinding(): Keymap {
  const binding = (behaviorId: number, param1 = 0, param2 = 0) => ({
    behaviorId,
    param1,
    param2,
  });
  const bindings = (first = binding(1, (7 << 16) + 4)) =>
    Array.from({ length: 43 }, (_, position) =>
      position === 0 ? first : binding(1, (7 << 16) + 4),
    );

  return {
    layers: [
      { id: 0, name: "Base", bindings: bindings() },
      { id: 4, name: "Auto Mouse", bindings: bindings(binding(2, 0)) },
    ],
    availableLayers: 9,
    maxLayerNameLength: 16,
  };
}

function keymapWithTransparentL3Binding(): Keymap {
  const binding = (behaviorId: number, param1 = 0, param2 = 0) => ({
    behaviorId,
    param1,
    param2,
  });
  const bindings = (first = binding(1, (7 << 16) + 4)) =>
    Array.from({ length: 43 }, (_, position) =>
      position === 0 ? first : binding(1, (7 << 16) + 4),
    );

  return {
    layers: [
      { id: 0, name: "Base", bindings: bindings() },
      { id: 3, name: "Symbols", bindings: bindings(binding(3)) },
    ],
    availableLayers: 9,
    maxLayerNameLength: 16,
  };
}

function MonitorKeymapPublisher({ keymap }: { keymap: Keymap | undefined }) {
  usePublishMonitorKeymap(keymap);
  return null;
}

function renderMonitorSurface(
  monitorStore: MonitorStore,
  monitorActive: boolean,
  keymap?: Keymap,
) {
  return render(
    <MonitorKeymapProvider>
      <MonitorKeymapPublisher keymap={keymap} />
      <KeyboardMonitorSurface
        monitorStore={monitorStore}
        monitorActive={monitorActive}
      />
    </MonitorKeymapProvider>,
  );
}

describe("KeyboardMonitorSurface", () => {
  it("shows the live keyboard, active layer, latest key, and pointer movement", () => {
    const store = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 1 });
    store.push({ kind: "key", position: 2, pressed: true });
    store.push({ kind: "holdTap", position: 2, phase: "hold" });
    store.push({
      kind: "pointer",
      dx: 4,
      dy: -2,
      wheel: 0,
      hwheel: 0,
      buttons: 0,
    });

    renderMonitorSurface(store, true);

    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("pos 2 E 押下中 長押し")).toBeInTheDocument();
    expect(screen.getByText("デフォルト")).toBeInTheDocument();
    expect(screen.getByText("#2 E")).toBeInTheDocument();
    expect(screen.getByText("dx +4 / dy -2")).toBeInTheDocument();
    expect(screen.getByText("接続中")).toBeInTheDocument();
  });

  it("clearly identifies a disconnected monitor", () => {
    renderMonitorSurface(createMonitorStore(), false);

    expect(screen.getByText("モニター未接続")).toBeInTheDocument();
  });

  it("uses the live L4 binding instead of the factory fallback", () => {
    const store = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 0b10001 });
    store.push({ kind: "key", position: 0, pressed: true });

    renderMonitorSurface(store, true, keymapWithL4ReturnBinding());

    expect(screen.getByTestId("monitor-key-label-0")).toHaveTextContent(
      "通常へ戻る",
    );
    expect(screen.getByText("#0 通常へ戻る")).toBeInTheDocument();
  });

  it("resolves a Transparent binding to its inherited live label", () => {
    const store = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 0b1001 });
    store.push({ kind: "key", position: 0, pressed: true });

    renderMonitorSurface(store, true, keymapWithTransparentL3Binding());

    expect(screen.getByTestId("monitor-key-label-0")).toHaveTextContent("A");
    expect(
      screen.getByRole("gridcell", {
        name: "pos 0 A 押下中",
        description: "下位レイヤーから継承",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Trans")).not.toBeInTheDocument();
    expect(screen.getByText("#0 A")).toBeInTheDocument();
  });
});
