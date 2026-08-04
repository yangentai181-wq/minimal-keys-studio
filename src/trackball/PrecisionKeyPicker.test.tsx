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
  it("shows the confirmed key action and updates only the draft when a supported key is selected", () => {
    const updateDraft = vi.fn();
    render(
      <PrecisionKeyPicker
        keymap={keymap}
        behaviors={behaviors}
        confirmed={{
          schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 1,
          originalBinding: { behaviorId: 2, param1: 2, param2: key(5) }, revision: 1, precisionActive: false, currentCpi: 800,
        }}
        draftPosition={1}
        updateDraft={updateDraft}
      />,
    );

    expect(screen.getByText("タップ動作は残り、長押し動作は精密モードに置き換わります")).toBeVisible();
    expect(screen.getByText("タップ: B")).toBeVisible();
    expect(screen.getByText("長押し: レイヤー 2")).toBeVisible();
    expect(screen.getByRole("button", { name: "キー 1" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "キー 2" }));

    expect(updateDraft).toHaveBeenCalledWith({ selectedPosition: 2 });
  });

  it("marks unsupported keys disabled with their reason", () => {
    render(
      <PrecisionKeyPicker
        keymap={keymap}
        behaviors={behaviors}
        confirmed={null}
        draftPosition={1}
        updateDraft={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "キー 3" })).toBeDisabled();
    expect(screen.getByText("透明キーは選択できません")).toBeVisible();
  });
});
