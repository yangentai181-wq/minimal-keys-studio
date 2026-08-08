import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitorPanel } from "./MonitorPanel";
import { createMonitorStore } from "./monitorStore";

describe("MonitorPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("changes a fresh pointer sample to stopped after 500ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T00:00:00Z"));
    const monitorStore = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    monitorStore.push({
      kind: "pointer",
      dx: 4,
      dy: -2,
      wheel: 0,
      hwheel: 0,
      buttons: 0,
    });

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

    expect(screen.getByText("dx=4 dy=-2 wheel=0 buttons=0")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("停止中")).toBeInTheDocument();
  });
});
