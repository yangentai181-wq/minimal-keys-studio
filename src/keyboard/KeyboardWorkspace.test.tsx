import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { createMonitorStore } from "../monitor/monitorStore";
import { KeyboardWorkspace } from "./KeyboardWorkspace";

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

describe("KeyboardWorkspace", () => {
  it("shows one keyboard and preserves editor state across mode switches", () => {
    render(
      <KeyboardWorkspace
        editor={<StatefulEditor />}
        monitorStore={createMonitorStore()}
        monitorActive
      />,
    );

    const editorButton = screen.getByRole("button", { name: "編集" });
    const monitorButton = screen.getByRole("button", { name: "リアルタイム" });
    expect(editorButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("grid")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("編集メモ"), {
      target: { value: "保持" },
    });
    fireEvent.click(monitorButton);

    expect(monitorButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("grid")).toHaveLength(1);
    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeInTheDocument();

    fireEvent.click(editorButton);

    expect(screen.getByLabelText("編集メモ")).toHaveValue("保持");
    expect(screen.getAllByRole("grid")).toHaveLength(1);
  });

  it("disables unavailable monitoring and exposes the USB recovery action", () => {
    const onConnectMonitor = vi.fn();
    render(
      <KeyboardWorkspace
        editor={<StatefulEditor />}
        monitorStore={createMonitorStore()}
        monitorActive={false}
        onConnectMonitor={onConnectMonitor}
      />,
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
      <KeyboardWorkspace
        editor={<StatefulEditor />}
        monitorStore={store}
        monitorActive
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "リアルタイム" }));

    rerender(
      <KeyboardWorkspace
        editor={<StatefulEditor />}
        monitorStore={store}
        monitorActive={false}
      />,
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
