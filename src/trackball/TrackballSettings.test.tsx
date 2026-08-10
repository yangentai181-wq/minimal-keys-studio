import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackballSettings } from "./TrackballSettings";
import * as RIP from "../proto/rip";

const mocks = vi.hoisted(() => ({
  subsystem: null as { subsystemIndex: number; callRPC: ReturnType<typeof vi.fn> } | null,
  toast: vi.fn(),
  notification: undefined as ((payload: Uint8Array) => void) | undefined,
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => mocks.subsystem,
  useCustomNotification: (_index: number | undefined, callback: (payload: Uint8Array) => void) => { mocks.notification = callback; },
}));

vi.mock("../misc/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("./TrackballPrecisionSettings", () => ({
  TrackballPrecisionSettings: () => (
    <section aria-label="精密モード設定">
      <h3>精密モード</h3>
    </section>
  ),
}));

vi.mock("../keyboard/useStudioKeymap", () => ({
  useStudioKeymap: () => ({
    loading: false,
    layers: [
      { id: 40, index: 4, name: "Mouse", bindings: [] },
      { id: 70, index: 7, name: "Scroll", bindings: [] },
    ],
  }),
}));

describe("TrackballSettings", () => {
  beforeEach(() => {
    mocks.subsystem = {
      subsystemIndex: 1,
      callRPC: vi.fn().mockResolvedValue(undefined),
    };
    mocks.notification = undefined;
    mocks.toast.mockReset();
    vi.restoreAllMocks();
  });

  it("preserves a multiple legacy scroll mask while saving another setting", async () => {
    const processor: RIP.InputProcessorInfo = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 144,
    };
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "setRotation" })
      .mockReturnValueOnce({ responseType: "setScrollLayers" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: { ...processor, rotationDegrees: 45 } });
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));

    expect(screen.getByRole("alert")).toHaveTextContent("複数レイヤー");
    fireEvent.change(screen.getByRole("spinbutton", { name: "度" }), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.subsystem?.callRPC).toHaveBeenCalledWith(RIP.encodeGetInputProcessor(1)));
    expect(mocks.subsystem?.callRPC).not.toHaveBeenCalledWith(RIP.encodeSetScrollLayers(1, 0));
  });

  it("places precision settings before the existing rotation, inversion, and scroll controls", () => {
    const { container } = render(<TrackballSettings />);

    const root = container.firstElementChild!;
    const precision = screen.getByRole("region", { name: "精密モード設定" });
    expect(root.querySelector("section")).toBe(precision);

    const rotation = screen.getByRole("spinbutton", { name: "度" });
    const xInvert = screen.getByRole("checkbox", { name: "X軸を反転" });
    const scrollMode = screen.getByRole("checkbox", { name: "スクロールモード" });
    expect(screen.getByRole("heading", { name: "回転角度" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "軸の設定" })).toBeVisible();

    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(xInvert);
    fireEvent.click(scrollMode);

    expect(rotation).toHaveValue(45);
    expect(xInvert).toBeChecked();
    expect(scrollMode).toBeChecked();
  });

  it("keeps precision settings visible when the legacy runtime subsystem is unavailable", () => {
    mocks.subsystem = null;
    const { container } = render(<TrackballSettings />);

    const root = container.firstElementChild!;
    const precision = screen.getByRole("region", { name: "精密モード設定" });
    expect(root.firstElementChild).toBe(precision);
    expect(screen.getByRole("heading", { name: "トラックボール設定は利用できません" })).toBeVisible();
  });

  it("shows editable scroll and Auto Mouse controls without exposing activation delay", () => {
    render(<TrackballSettings />);

    expect(screen.getByLabelText("スクロールするレイヤー")).toBeVisible();
    expect(screen.getByLabelText("スクロールするレイヤー")).toHaveTextContent("なし");
    expect(screen.getByLabelText("Auto Mouseを有効にする")).toBeVisible();
    expect(screen.getByLabelText("Auto Mouseレイヤー")).toBeVisible();
    const delay = screen.getByLabelText("ボール停止後に戻るまで");
    expect(delay).toHaveAttribute("min", "100");
    expect(delay).toHaveAttribute("max", "5000");
    expect(delay).toHaveAttribute("step", "50");
    expect(screen.queryByText(/起動待ち/)).not.toBeInTheDocument();
  });
});
