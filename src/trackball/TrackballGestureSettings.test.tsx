import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding, Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackballGestureSettings } from "./TrackballGestureSettings";
import { useConnectedGestureKeymap } from "./useConnectedGestureKeymap";

const updateBinding = vi.fn();
const keyPress: BehaviorBinding = { behaviorId: 1, param1: 0, param2: 0 };
const none: BehaviorBinding = { behaviorId: 2, param1: 0, param2: 0 };
const unknown: BehaviorBinding = { behaviorId: 99, param1: 0, param2: 0 };
const behaviors: GetBehaviorDetailsResponse[] = [
  { id: 1, displayName: "Key Press", metadata: [] },
  { id: 2, displayName: "None", metadata: [] },
];

function keymap(): Keymap {
  return {
    layers: Array.from({ length: 10 }, (_, id) => ({
      id,
      name: id === 9 ? "Gesture" : `Layer ${id}`,
      bindings: Array.from({ length: 43 }, () => keyPress),
    })),
    availableLayers: 10,
    maxLayerNameLength: 16,
  };
}

vi.mock("./useConnectedGestureKeymap", () => ({
  useConnectedGestureKeymap: vi.fn(),
}));

vi.mock("../behaviors/BehaviorBindingPicker", () => ({
  BehaviorBindingPicker: ({ binding, onBindingChanged }: { binding: BehaviorBinding; onBindingChanged(binding: BehaviorBinding): void }) => (
    <button data-testid="behavior-binding-picker" onClick={() => onBindingChanged({ ...binding, behaviorId: 2 })}>
      割当を何もしないに変更
    </button>
  ),
}));

describe("TrackballGestureSettings", () => {
  beforeEach(() => {
    updateBinding.mockReset().mockResolvedValue(undefined);
    vi.mocked(useConnectedGestureKeymap).mockReturnValue({
      availability: "available",
      keymap: keymap(),
      behaviors,
      error: null,
      updateBinding,
    });
  });

  it("shows four direction tiles and edits only the selected direction", () => {
    const currentKeymap = keymap();
    currentKeymap.layers[9].bindings[31] = none;
    currentKeymap.layers[9].bindings[18] = unknown;
    vi.mocked(useConnectedGestureKeymap).mockReturnValue({
      availability: "available", keymap: currentKeymap, behaviors, error: null, updateBinding,
    });
    render(<TrackballGestureSettings />);

    const directions = screen.getByRole("group", { name: "フリック方向" });
    expect(directions).toBeVisible();
    expect(screen.getByRole("button", { name: /上/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /左/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("何もしない")).toBeVisible();
    expect(screen.getByText("不明な操作")).toBeVisible();
    expect(screen.getAllByTestId("behavior-binding-picker")).toHaveLength(1);

    const up = screen.getByRole("button", { name: /上/ });
    expect(up).toHaveClass("min-h-11", "focus-visible:ring-2");
    expect(up.querySelector(".text-base-content\\/70")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /左/ }));
    expect(screen.getByRole("button", { name: /左/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("選択中: 左フリック")).toBeVisible();
    fireEvent.click(screen.getByTestId("behavior-binding-picker"));
    expect(updateBinding).toHaveBeenCalledWith("left", { behaviorId: 2, param1: 0, param2: 0 });
  });

  it.each([
    ["loading", "設定を読み込んでいます…"],
    ["disconnected", "キーボードに接続すると設定できます"],
    ["firmware-update-required", "ファームウェアの更新が必要です"],
    ["error", "設定の読み込みに失敗しました"],
  ] as const)("shows the truthful %s state without an editor", (availability, message) => {
    vi.mocked(useConnectedGestureKeymap).mockReturnValue({
      availability, keymap: null, behaviors: [], error: availability === "error" ? "read failed" : null, updateBinding,
    });
    render(<TrackballGestureSettings />);

    expect(screen.getByText("キーボード共通")).toBeVisible();
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.queryByText("ジェスチャー中")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /保存|適用/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("behavior-binding-picker")).not.toBeInTheDocument();
  });
});
