import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MinimalKeysMonitorLayout } from "./MinimalKeysMonitorLayout";
import { MonitorPanel } from "./MonitorPanel";
import {
  getMonitorKeyLabel,
  MONITOR_KEY_LABELS_BY_LAYER,
} from "./minimalKeysMonitorLabels";
import { MONITOR_LAYER_NAMES } from "./layerNames";
import { createMonitorStore } from "./monitorStore";

describe("MinimalKeysMonitorLayout", () => {
  it("renders the physical minimal-keys positions and highlights pressed keys", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerMask={1}
        pressed={new Set([40])}
      />,
    );

    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("gridcell")).toHaveLength(43);
    expect(screen.getByLabelText("pos 40 Enter / Shift 押下中")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("uses active layer labels and falls back to base labels for transparent keys", () => {
    expect(getMonitorKeyLabel(5, 6)).toEqual({
      label: "USB",
      transparent: false,
    });
    expect(getMonitorKeyLabel(0, 7)).toEqual({
      label: "Q",
      transparent: true,
    });
  });

  it("resolves monitor-only labels through every active factory layer", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerMask={(1 << 0) | (1 << 3) | (1 << 8)}
        pressed={new Set()}
      />,
    );

    expect(screen.getByTestId("monitor-key-label-0")).toHaveTextContent(
      "Cmd+0",
    );
  });

  it("uses readable type sizes for short and dual-function labels", () => {
    render(
      <MinimalKeysMonitorLayout activeLayerMask={1} pressed={new Set()} />,
    );

    expect(screen.getByTestId("monitor-key-label-0")).toHaveClass(
      "text-base",
      "font-bold",
    );
    expect(screen.getByTestId("monitor-key-label-40")).toHaveClass(
      "text-sm",
      "font-bold",
    );
  });

  it("shows accessible pending, tap, and orange hold decisions on their keys", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerMask={1}
        pressed={new Set([0, 1, 2])}
        holdTapStates={{ 0: "pending", 1: "tap", 2: "hold" }}
      />,
    );

    expect(screen.getByText("判定中")).toHaveClass("text-primary");
    expect(screen.getByText("単押し")).toHaveClass("text-success");
    expect(screen.getByText("長押し")).toHaveClass(
      "bg-orange-500",
      "text-white",
    );
    expect(screen.getByLabelText("pos 2 E 押下中 長押し")).toBeTruthy();
  });

  it("mirrors the factory fallback labels for standard controls and layer returns", () => {
    expect(MONITOR_LAYER_NAMES[1]).toBe("数字");
    expect(MONITOR_LAYER_NAMES[8]).toBe("精密モード");

    for (const [position, layerIndex, label] of [
      [10, 2, "Insert"],
      [21, 2, "Delete"],
      [28, 3, "["],
      [29, 3, "]"],
      [4, 5, "Cmd+Shift+3"],
      [5, 5, "Cmd+Shift+4"],
      [6, 5, "Brightness -"],
      [7, 5, "Brightness +"],
      [8, 5, "Volume -"],
      [9, 5, "Volume +"],
      [33, 5, "Caps Lock"],
    ] as const) {
      expect(getMonitorKeyLabel(position, layerIndex)).toEqual({
        label,
        transparent: false,
      });
    }

    for (const position of [
      0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 16, 17, 20, 21,
      22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
      40, 41, 42,
    ]) {
      expect(getMonitorKeyLabel(position, 4)).toEqual({
        label: "通常へ戻る",
        transparent: false,
      });
    }

    expect(
      [22, 23, 24, 25, 26, 27].map((position) =>
        getMonitorKeyLabel(position, 5),
      ),
    ).toEqual([
      { label: "F7", transparent: false },
      { label: "F8", transparent: false },
      { label: "F9", transparent: false },
      { label: "F10", transparent: false },
      { label: "F11", transparent: false },
      { label: "F12", transparent: false },
    ]);
  });

  it("keeps all nine factory fallback layers aligned to the 43 physical positions", () => {
    expect(MONITOR_KEY_LABELS_BY_LAYER.map((labels) => labels.length)).toEqual(
      Array.from({ length: 9 }, () => 43),
    );
  });

  it("renders resolved live labels and describes inherited keys", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerMask={1 << 7}
        pressed={new Set()}
        resolvedBindings={[
          {
            label: "A",
            sourceLayerId: 0,
            sourceLayerIndex: 0,
            inherited: true,
            unknown: false,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("monitor-key-label-0")).toHaveTextContent("A");
    expect(
      screen.getByRole("gridcell", {
        name: "pos 0 A",
        description: "下位レイヤーから継承",
      }),
    ).toBeInTheDocument();
  });

  it("identifies monitor-only labels as factory-setting guidance", () => {
    render(
      <MonitorPanel
        monitorStore={createMonitorStore()}
        description={{
          title: "Raw HIDで監視中",
          body: "編集接続は利用できません。",
          monitorAvailable: true,
          editorAvailable: false,
        }}
        editorAvailable={false}
      />,
    );

    expect(screen.getByText("出荷時設定の目安")).toBeInTheDocument();
  });

  it("uses factory-mask resolution for monitor-only pressed-key labels", () => {
    const monitorStore = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    monitorStore.push({
      kind: "layer",
      defaultLayer: 0,
      activeLayerMask: (1 << 0) | (1 << 3) | (1 << 8),
    });
    monitorStore.push({ kind: "key", position: 0, pressed: true });

    render(
      <MonitorPanel
        monitorStore={monitorStore}
        description={{
          title: "Raw HIDで監視中",
          body: "編集接続は利用できません。",
          monitorAvailable: true,
          editorAvailable: false,
        }}
        editorAvailable={false}
      />,
    );

    expect(screen.getByText("#0 Cmd+0")).toBeInTheDocument();
  });
});
