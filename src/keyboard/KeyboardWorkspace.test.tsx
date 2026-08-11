import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { createMonitorStore } from "../monitor/monitorStore";
import {
  KeyboardWorkspace,
  type KeyboardWorkspaceProps,
} from "./KeyboardWorkspace";
import { MonitorKeymapProvider } from "./MonitorKeymapContext";

vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorMap: () => ({}),
}));

function StatefulEditor() {
  const [memo, setMemo] = useState("");

  return (
    <section role="grid" aria-label="編集キーボード">
      <label>
        編集メモ
        <input
          aria-label="編集メモ"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </label>
    </section>
  );
}

function workspaceWithMonitorKeymap(props: KeyboardWorkspaceProps) {
  return (
    <MonitorKeymapProvider>
      <KeyboardWorkspace {...props} />
    </MonitorKeymapProvider>
  );
}

describe("KeyboardWorkspace", () => {
  it("shows one keyboard and preserves editor state across mode switches", () => {
    render(
      workspaceWithMonitorKeymap({
        editor: <StatefulEditor />,
        monitorStore: createMonitorStore(),
        monitorActive: true,
      }),
    );

    const editorButton = screen.getByRole("button", { name: "編集" });
    const monitorButton = screen.getByRole("button", { name: "リアルタイム" });
    expect(editorButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("keyboard-workspace-content")).toHaveAttribute(
      "data-motion-state",
      "enter",
    );
    expect(screen.getAllByRole("grid")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("編集メモ"), {
      target: { value: "保持" },
    });
    fireEvent.click(monitorButton);

    expect(monitorButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("keyboard-workspace-content")).toHaveAttribute(
      "data-motion-view",
      "monitor",
    );
    expect(screen.getByTestId("keyboard-workspace-content")).toHaveAttribute(
      "data-motion-state",
      "enter",
    );
    expect(screen.getAllByRole("grid")).toHaveLength(1);
    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeInTheDocument();

    fireEvent.click(editorButton);

    expect(screen.getByLabelText("編集メモ")).toHaveValue("保持");
    expect(screen.getByTestId("keyboard-workspace-content")).toHaveAttribute(
      "data-motion-view",
      "editor",
    );
    expect(screen.getByTestId("keyboard-workspace-content")).toHaveAttribute(
      "data-motion-state",
      "enter",
    );
    expect(screen.getAllByRole("grid")).toHaveLength(1);
  });

  it("disables unavailable monitoring and exposes the USB recovery action", () => {
    const onConnectMonitor = vi.fn();
    render(
      workspaceWithMonitorKeymap({
        editor: <StatefulEditor />,
        monitorStore: createMonitorStore(),
        monitorActive: false,
        onConnectMonitor,
      }),
    );

    expect(screen.getByRole("button", { name: "リアルタイム" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "右手USBモニターを接続" }),
    );
    expect(onConnectMonitor).toHaveBeenCalledOnce();
  });

  it("keeps realtime visible when the monitor disconnects after selection", () => {
    const store = createMonitorStore();
    const { rerender } = render(
      workspaceWithMonitorKeymap({
        editor: <StatefulEditor />,
        monitorStore: store,
        monitorActive: true,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "リアルタイム" }));

    rerender(
      workspaceWithMonitorKeymap({
        editor: <StatefulEditor />,
        monitorStore: store,
        monitorActive: false,
      }),
    );

    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeInTheDocument();
    expect(screen.getByText("モニター未接続")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "リアルタイム" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
