import { fireEvent, render, screen } from "@testing-library/react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { describe, expect, it, vi } from "vitest";
import { PrecisionKeyPicker } from "./PrecisionKeyPicker";

vi.mock("../rpc/useConnectedDeviceData", () => ({ useConnectedDeviceData: vi.fn() }));
vi.mock("../behaviors/BehaviorsContext", () => ({ useBehaviorList: vi.fn() }));
vi.mock("./TrackballPrecisionContext", () => ({ useTrackballPrecision: vi.fn() }));

const behavior = (id: number, displayName: string): GetBehaviorDetailsResponse => ({
  id,
  displayName,
  metadata: [],
});

const behaviors = [
  behavior(1, "Key Press"),
  behavior(2, "Layer-Tap"),
  behavior(3, "Transparent"),
  behavior(4, "Mod-Tap"),
];
const key = (id: number) => (7 << 16) + id;

const keymap = {
  layers: [{
    id: 0,
    name: "Default",
    bindings: [
      { behaviorId: 1, param1: key(4), param2: 0 },
      { behaviorId: 2, param1: 2, param2: key(5) },
      { behaviorId: 1, param1: key(6), param2: 0 },
      { behaviorId: 3, param1: 0, param2: 0 },
    ],
  }],
  availableLayers: 9,
  maxLayerNameLength: 16,
};

describe("PrecisionKeyPicker", () => {
  it("shows the original confirmed action and updates the draft from the visible physical key", () => {
    const updateDraft = vi.fn();
    const wrappedKeymap = {
      ...keymap,
      layers: [{
        ...keymap.layers[0],
        bindings: keymap.layers[0].bindings.map((binding, position) => position === 1
          ? { behaviorId: 2, param1: 8, param2: key(8) }
          : binding),
      }],
    };
    render(
      <PrecisionKeyPicker
        keymap={wrappedKeymap}
        behaviors={behaviors}
        confirmed={{
          schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 1,
          originalBinding: { behaviorId: 4, param1: 2, param2: key(5) }, revision: 1, precisionActive: false, currentCpi: 800,
        }}
        draftPosition={1}
        updateDraft={updateDraft}
      />,
    );

    expect(screen.getByText("タップ動作は残り、長押し動作は精密モードに置き換わります")).toBeVisible();
    expect(screen.getByText("タップ: B")).toBeVisible();
    expect(screen.getByText("長押し: 左Shift")).toBeVisible();
    expect(screen.getByRole("button", { name: /選択可.*キー 1/ })).toHaveClass("bg-primary");

    fireEvent.click(screen.getByRole("button", { name: /選択可.*キー 2/ }));

    expect(updateDraft).toHaveBeenCalledWith({ selectedPosition: 2 });
  });

  it("shows unsupported physical keys as unavailable and does not select non-key bindings", () => {
    const updateDraft = vi.fn();
    const keymapWithExtraBinding = {
      ...keymap,
      layers: [{ ...keymap.layers[0], bindings: [...keymap.layers[0].bindings, { behaviorId: 1, param1: key(7), param2: 0 }] }],
    };
    render(
      <PrecisionKeyPicker
        keymap={keymapWithExtraBinding}
        behaviors={behaviors}
        confirmed={null}
        draftPosition={1}
        updateDraft={updateDraft}
      />,
    );

    const unavailable = screen.getByRole("button", { name: /使用不可.*キー 3.*透明キーは選択できません/ });
    fireEvent.click(unavailable);
    expect(updateDraft).not.toHaveBeenCalled();
    expect(screen.getByText("透明キーは選択できません")).toBeVisible();
    expect(screen.queryByRole("button", { name: /キー 43/ })).not.toBeInTheDocument();
  });

  it("uses layer ID 0 rather than its array position and reports unavailable when it is missing", () => {
    const layerZeroSecond = { ...keymap, layers: [{ ...keymap.layers[0], id: 4 }, keymap.layers[0]] };
    const { rerender } = render(
      <PrecisionKeyPicker keymap={layerZeroSecond} behaviors={behaviors} confirmed={null} draftPosition={0} updateDraft={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /選択可.*キー 0/ })).toBeInTheDocument();

    rerender(
      <PrecisionKeyPicker keymap={{ ...keymap, layers: [{ ...keymap.layers[0], id: 4 }] }} behaviors={behaviors} confirmed={null} draftPosition={0} updateDraft={vi.fn()} />,
    );
    expect(screen.getByText("ベースレイヤーを読み込めません")).toBeVisible();
  });
});
