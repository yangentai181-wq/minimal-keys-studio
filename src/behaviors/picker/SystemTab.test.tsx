import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SystemTab } from "./SystemTab";

const mockBehaviors = [
  { id: 30, displayName: "None", metadata: [] },
  { id: 31, displayName: "Transparent", metadata: [] },
  { id: 32, displayName: "Bluetooth", metadata: [] },
  { id: 33, displayName: "Reset", metadata: [] },
  { id: 34, displayName: "Bootloader", metadata: [] },
  { id: 35, displayName: "Soft Off", metadata: [] },
  { id: 1, displayName: "Key Press", metadata: [] },
];

describe("SystemTab", () => {
  it("renders system options (excludes non-system behaviors)", () => {
    const onApply = vi.fn();
    render(<SystemTab behaviors={mockBehaviors} onApplyBinding={onApply} />);
    expect(screen.getByText("無効")).toBeTruthy();
    expect(screen.getByText("透過")).toBeTruthy();
    expect(screen.getByText("リセット")).toBeTruthy();
    expect(screen.queryByText("キー入力")).toBeNull();
  });

  it("None: click to apply immediately", () => {
    const onApply = vi.fn();
    render(<SystemTab behaviors={mockBehaviors} onApplyBinding={onApply} />);
    fireEvent.click(screen.getByText("無効"));
    expect(onApply).toHaveBeenCalledWith({ behaviorId: 30, param1: 0, param2: 0 });
  });

  it("Transparent: click to apply immediately", () => {
    const onApply = vi.fn();
    render(<SystemTab behaviors={mockBehaviors} onApplyBinding={onApply} />);
    fireEvent.click(screen.getByText("透過"));
    expect(onApply).toHaveBeenCalledWith({ behaviorId: 31, param1: 0, param2: 0 });
  });

  it("orders None and Transparent first regardless of API response order", () => {
    render(
      <SystemTab
        behaviors={[
          { id: 33, displayName: "Reset", metadata: [] },
          { id: 31, displayName: "Transparent", metadata: [] },
          { id: 30, displayName: "None", metadata: [] },
        ]}
        onApplyBinding={() => {}}
      />,
    );

    expect(
      screen.getAllByRole("button").slice(0, 3).map((button) => button.textContent),
    ).toEqual([
      "無効このキーを無効化する。押しても何も起きない",
      "透過このレイヤーでは何も割り当てず、下のレイヤーの割り当てをそのまま使う",
      "リセットキーボードを再起動する",
    ]);
  });

  it("does not synthesize Transparent when the API omits it", () => {
    render(
      <SystemTab
        behaviors={[{ id: 30, displayName: "None", metadata: [] }]}
        onApplyBinding={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: /^透過/ })).not.toBeInTheDocument();
  });

  it("renders Bluetooth operations", () => {
    const onApply = vi.fn();
    render(<SystemTab behaviors={mockBehaviors} onApplyBinding={onApply} />);
    expect(screen.getByText("BT クリア")).toBeTruthy();
    expect(screen.getByText("BT 次へ")).toBeTruthy();
  });

  it("BT operation: click to apply with param1", () => {
    const onApply = vi.fn();
    render(<SystemTab behaviors={mockBehaviors} onApplyBinding={onApply} />);
    fireEvent.click(screen.getByText("BT 次へ"));
    expect(onApply).toHaveBeenCalledWith({ behaviorId: 32, param1: 1, param2: 0 });
  });
});
