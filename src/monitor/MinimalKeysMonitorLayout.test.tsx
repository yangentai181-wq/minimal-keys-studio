import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MinimalKeysMonitorLayout } from "./MinimalKeysMonitorLayout";
import { MonitorPanel } from "./MonitorPanel";
import {
  getMonitorKeyLabel,
  MONITOR_KEY_LABELS_BY_LAYER,
} from "./minimalKeysMonitorLabels";
import { createMonitorStore } from "./monitorStore";

describe("MinimalKeysMonitorLayout", () => {
  it("renders the physical minimal-keys positions and highlights pressed keys", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerIndex={0}
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

  it("uses readable type sizes for short and dual-function labels", () => {
    render(
      <MinimalKeysMonitorLayout activeLayerIndex={0} pressed={new Set()} />,
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
        activeLayerIndex={0}
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

  it("keeps every static monitor layer aligned to the 43 physical positions", () => {
    expect(MONITOR_KEY_LABELS_BY_LAYER.map((labels) => labels.length)).toEqual(
      Array.from({ length: 8 }, () => 43),
    );
  });

  it("renders resolved live labels and describes inherited keys", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerIndex={7}
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
});
