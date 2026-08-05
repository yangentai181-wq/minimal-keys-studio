import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Keyboard from "./Keyboard";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1 },
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client/keymap", () => ({
  SetLayerBindingResponse: { SET_LAYER_BINDING_RESP_OK: 1 },
  SetLayerPropsResponse: { SET_LAYER_PROPS_RESP_OK: 1 },
}));

vi.mock("../rpc/logging", () => ({
  call_rpc: vi.fn(async () => ({
    keymap: {
      getPhysicalLayouts: {
        layouts: [{ keys: [] }],
        activeLayoutIndex: 0,
      },
    },
  })),
}));

vi.mock("../rpc/useConnectedDeviceData", () => ({
  useConnectedDeviceData: () => [{ layers: [], availableLayers: 0 }, vi.fn()],
}));

vi.mock("../rpc/ConnectionContext", async () => {
  const { createContext } = await import("react");
  return { ConnectionContext: createContext({ conn: {} }) };
});

vi.mock("../rpc/LockStateContext", async () => {
  const { createContext } = await import("react");
  return { LockStateContext: createContext(1) };
});

vi.mock("../undoRedo", async () => {
  const { createContext } = await import("react");
  return { UndoRedoContext: createContext(undefined) };
});

vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../OsModeContext", () => ({ useOsMode: () => ({ osMode: "mac" }) }));
vi.mock("../telemetry/TelemetryProvider", () => ({ useTelemetry: () => ({ trackKeymap: vi.fn() }) }));

vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorMap: () => ({}),
  useBehaviorsLoading: () => false,
}));

vi.mock("./Keymap", () => ({
  Keymap: () => <div>キーマップ本体</div>,
}));

vi.mock("./PhysicalLayoutPicker", () => ({
  PhysicalLayoutPicker: () => <div>レイアウト</div>,
}));

vi.mock("./LayerPicker", () => ({
  LayerPicker: () => <div>レイヤー</div>,
}));

vi.mock("./ModifierPanel", () => ({
  ModifierPanel: () => null,
}));

vi.mock("../behaviors/BehaviorBindingPicker", () => ({
  BehaviorBindingPicker: () => null,
}));

vi.mock("./useEncoderBindings", () => ({
  useEncoderBindings: () => undefined,
}));

function renderKeyboard() {
  return render(<Keyboard />);
}

describe("Keyboard loading", () => {
  it("shows the keyboard as soon as required data resolves within 100ms", async () => {
    vi.useFakeTimers();
    renderKeyboard();

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("キーマップ本体")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps the spinner visible while required data is unresolved", () => {
    vi.useFakeTimers();
    renderKeyboard();

    expect(screen.getByText("キーマップを読み込んでいます...")).toBeInTheDocument();
    expect(screen.queryByText("キーマップ本体")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
