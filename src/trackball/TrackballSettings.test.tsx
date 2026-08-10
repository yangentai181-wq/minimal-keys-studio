import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackballSettings } from "./TrackballSettings";
import * as RIP from "../proto/rip";

const mocks = vi.hoisted(() => ({
  subsystem: null as { subsystemIndex: number; callRPC: ReturnType<typeof vi.fn> } | null,
  toast: vi.fn(),
  notification: undefined as ((payload: Uint8Array) => void) | undefined,
  dirtyRegistration: undefined as { dirty: boolean; save(): Promise<boolean>; discard(): Promise<boolean>; snapshot?(): unknown; restore?(snapshot: unknown): void } | undefined,
  layers: [
    { id: 40, index: 4, name: "Mouse", bindings: [] },
    { id: 70, index: 7, name: "Scroll", bindings: [] },
  ] as Array<{ id: number; index: number; name: string; bindings: unknown[] }>,
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => mocks.subsystem,
  useCustomNotification: (_index: number | undefined, callback: (payload: Uint8Array) => void) => { mocks.notification = callback; },
}));

vi.mock("../misc/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../navigation/DirtyStateContext", () => ({
  useDirtyRegistration: (_id: string, registration: typeof mocks.dirtyRegistration) => { mocks.dirtyRegistration = registration; },
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
    layers: mocks.layers,
  }),
}));

describe("TrackballSettings", () => {
  beforeEach(() => {
    mocks.subsystem = {
      subsystemIndex: 1,
      callRPC: vi.fn().mockResolvedValue(undefined),
    };
    mocks.notification = undefined;
    mocks.dirtyRegistration = undefined;
    mocks.layers = [
      { id: 40, index: 4, name: "Mouse", bindings: [] },
      { id: 70, index: 7, name: "Scroll", bindings: [] },
    ];
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
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: { ...processor, rotationDegrees: 45 } });
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));

    expect(screen.getByRole("alert")).toHaveTextContent("複数レイヤー");
    fireEvent.change(screen.getByRole("spinbutton", { name: "度" }), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "適用" })).toBeEnabled());
    expect(mocks.dirtyRegistration?.dirty).toBe(false);
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.subsystem?.callRPC.mock.calls).toEqual([
      [RIP.encodeListInputProcessors()],
      [RIP.encodeSetRotation(1, 45)],
      [RIP.encodeGetInputProcessor(1)],
    ]);
  });

  it("snapshots and restores every Trackball draft field including the selected processor", () => {
    render(<TrackballSettings />);

    const snapshot = mocks.dirtyRegistration?.snapshot?.() as Record<string, unknown>;
    expect(snapshot).toMatchObject({
      selectedId: null, multiplier: 1, divisor: 1, rotation: 0, xInvert: false, yInvert: false,
      xySwap: false, xyToScroll: false, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeout: 0,
      scrollLayerId: null, scrollMask: 0, scrollTouched: false, autoMouseEnabled: false,
      autoMouseLayerId: null, autoMouseDeactivationDelayMs: 700,
    });
    act(() => mocks.dirtyRegistration?.restore?.({ ...snapshot, selectedId: 99, rotation: 55, scrollMask: 16, scrollTouched: true }));
    expect(mocks.dirtyRegistration?.snapshot?.()).toMatchObject({ selectedId: 99, rotation: 55, scrollMask: 16, scrollTouched: true });
    expect(screen.getByRole("spinbutton", { name: "度" })).toHaveValue(55);
  });

  it("keeps a newer edit when an older Apply readback arrives", async () => {
    const processor: RIP.InputProcessorInfo = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    };
    const deferred: Array<(value: Uint8Array) => void> = [];
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "setRotation" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: { ...processor, rotationDegrees: 45 } });
    mocks.subsystem!.callRPC.mockImplementation((() => {
      let call = 0;
      return () => {
        call++;
        if (call === 1) return Promise.resolve(new Uint8Array());
        return new Promise<Uint8Array>((resolve) => deferred.push(resolve));
      };
    })());
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(deferred).toHaveLength(1));
    deferred.shift()?.(new Uint8Array([1]));
    await waitFor(() => expect(mocks.subsystem?.callRPC).toHaveBeenCalledTimes(3));
    fireEvent.change(rotation, { target: { value: "90" } });
    await waitFor(() => expect(deferred).toHaveLength(1));
    deferred.shift()?.(new Uint8Array([1]));

    await waitFor(() => expect(screen.getByRole("button", { name: "適用" })).toBeEnabled());
    expect(screen.getByRole("spinbutton", { name: "度" })).toHaveValue(90);
    expect(mocks.dirtyRegistration?.dirty).toBe(true);
  });

  it("keeps a newer draft when deferred Reset readback completes", async () => {
    const processor: RIP.InputProcessorInfo = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    };
    const deferred: Array<(value: Uint8Array) => void> = [];
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "resetInputProcessor" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: processor });
    mocks.subsystem!.callRPC.mockImplementation((() => {
      let call = 0;
      return () => ++call === 1 ? Promise.resolve(new Uint8Array()) : new Promise<Uint8Array>((resolve) => deferred.push(resolve));
    })());
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "初期値に戻す" }));
    await waitFor(() => expect(deferred).toHaveLength(1));
    deferred.shift()?.(new Uint8Array([1]));
    await waitFor(() => expect(deferred).toHaveLength(1));
    fireEvent.change(rotation, { target: { value: "90" } });
    deferred.shift()?.(new Uint8Array([1]));

    await waitFor(() => expect(screen.getByRole("button", { name: "初期値に戻す" })).toBeEnabled());
    expect(rotation).toHaveValue(90);
    expect(mocks.dirtyRegistration?.dirty).toBe(true);
  });

  it("returns false from dirty-navigation save when a newer draft appears during Apply", async () => {
    const processor: RIP.InputProcessorInfo = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    };
    const deferred: Array<(value: Uint8Array) => void> = [];
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "setRotation" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: { ...processor, rotationDegrees: 45 } });
    mocks.subsystem!.callRPC.mockImplementation((() => {
      let call = 0;
      return () => ++call === 1 ? Promise.resolve(new Uint8Array()) : new Promise<Uint8Array>((resolve) => deferred.push(resolve));
    })());
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    const save = mocks.dirtyRegistration!.save();
    await waitFor(() => expect(deferred).toHaveLength(1));
    deferred.shift()?.(new Uint8Array([1]));
    await waitFor(() => expect(deferred).toHaveLength(1));
    fireEvent.change(rotation, { target: { value: "90" } });
    deferred.shift()?.(new Uint8Array([1]));

    await expect(save).resolves.toBe(false);
    expect(rotation).toHaveValue(90);
    expect(mocks.dirtyRegistration?.dirty).toBe(true);
  });

  it("derives an untouched scroll selection from the raw mask after keymap loading", () => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    } satisfies RIP.InputProcessorInfo;
    mocks.layers = [];
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    const view = render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    expect(screen.getByRole("alert")).toHaveTextContent("選んだレイヤーが見つかりません");

    mocks.layers = [{ id: 40, index: 4, name: "Mouse", bindings: [] }];
    view.rerender(<TrackballSettings />);

    expect(screen.getByLabelText("スクロールするレイヤー")).toHaveValue("40");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows firmware guidance only for the exact legacy SetScrollLayers error", async () => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 0,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ error: "Failed to process request" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: processor });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    fireEvent.change(screen.getByLabelText("スクロールするレイヤー"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("スクロールレイヤーを変更するには、キーボードのFirmware更新が必要です。", "error"));
    expect(mocks.toast).toHaveBeenCalledWith("トラックボール設定を保存できませんでした。接続を確認して、もう一度お試しください。", "error");
    expect(mocks.subsystem?.callRPC).toHaveBeenCalledWith(RIP.encodeSetScrollLayers(1, 16));
  });

  it.each([
    ["legacy error", { error: "Failed to process request" }, true],
    ["empty response", {}, true],
    ["wrong oneof", { responseType: "setRotation" }, true],
    ["other explicit error", { error: "denied" }, false],
  ])("classifies Scroll %s firmware guidance as %s", async (_name, response, firmwareRequired) => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 0,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce(response as RIP.RipResponse)
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: processor });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    fireEvent.change(screen.getByLabelText("スクロールするレイヤー"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("トラックボール設定を保存できませんでした。接続を確認して、もう一度お試しください。", "error"));
    expect(mocks.toast.mock.calls.some(([message]) => message === "スクロールレイヤーを変更するには、キーボードのFirmware更新が必要です。")).toBe(firmwareRequired);
  });

  it("sends only changed Auto Mouse and Scroll setters with their distinct layer values", async () => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 70, tempLayerActivationDelayMs: 999, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 0,
    } satisfies RIP.InputProcessorInfo;
    const submitted = { ...processor, scrollLayers: 16, tempLayerEnabled: true, tempLayerLayer: 40, tempLayerDeactivationDelayMs: 150 };
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "setScrollLayers" })
      .mockReturnValueOnce({ responseType: "setTempLayerEnabled" })
      .mockReturnValueOnce({ responseType: "setTempLayerLayer" })
      .mockReturnValueOnce({ responseType: "setTempLayerDeactivationDelay" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: submitted });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    fireEvent.change(screen.getByLabelText("スクロールするレイヤー"), { target: { value: "40" } });
    fireEvent.click(screen.getByLabelText("Auto Mouseを有効にする"));
    fireEvent.change(screen.getByLabelText("Auto Mouseレイヤー"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("ボール停止後に戻るまで"), { target: { value: "125" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "適用" })).toBeEnabled());
    expect(mocks.dirtyRegistration?.dirty).toBe(false);
    expect(mocks.subsystem?.callRPC.mock.calls.map(([payload]) => [...payload as Uint8Array])).toEqual([
      [10, 0],
      [162, 1, 4, 8, 1, 16, 16],
      [58, 4, 8, 1, 16, 1],
      [66, 4, 8, 1, 16, 40],
      [82, 5, 8, 1, 16, 150, 1],
      [18, 2, 8, 1],
    ]);
    expect(mocks.subsystem?.callRPC.mock.calls.some(([payload]) => (payload as Uint8Array)[0] === 74)).toBe(false);
  });

  it.each([
    ["response error", { error: "denied" }],
    ["empty response", {}],
    ["wrong response oneof", { responseType: "setXInvert" }],
  ])("retains the draft after a setter %s", async (_name, setterResponse) => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce(setterResponse as RIP.RipResponse)
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: processor });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("トラックボール設定を保存できませんでした。接続を確認して、もう一度お試しください。", "error"));
    expect(rotation).toHaveValue(45);
    expect(mocks.dirtyRegistration?.dirty).toBe(true);
    expect(mocks.subsystem?.callRPC).toHaveBeenCalledWith(RIP.encodeGetInputProcessor(1));
  });

  it("retains the Scroll draft after a timeout without firmware guidance", async () => {
    vi.useFakeTimers();
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 0,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse").mockReturnValue({ responseType: "getInputProcessor", getInputProcessor: processor });
    let calls = 0;
    mocks.subsystem!.callRPC.mockImplementation(() => {
      calls++;
      return calls === 2 ? new Promise<Uint8Array>(() => undefined) : Promise.resolve(new Uint8Array([1]));
    });
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const scroll = screen.getByLabelText("スクロールするレイヤー");
    fireEvent.change(scroll, { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.toast).toHaveBeenCalledWith("トラックボール設定を保存できませんでした。接続を確認して、もう一度お試しください。", "error");
    expect(mocks.toast).not.toHaveBeenCalledWith("スクロールレイヤーを変更するには、キーボードのFirmware更新が必要です。", "error");
    expect(scroll).toHaveValue("40");
    expect(mocks.dirtyRegistration?.dirty).toBe(true);
    vi.useRealTimers();
  });

  it("keeps the draft and reports failure when Reset readback has another processor ID", async () => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "resetInputProcessor" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: { ...processor, id: 2, rotationDegrees: 90 } });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "初期値に戻す" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("トラックボール設定を初期化できませんでした。接続を確認して、もう一度お試しください。", "error"));
    expect(rotation).toHaveValue(45);
    expect(mocks.subsystem?.callRPC).toHaveBeenCalledWith(RIP.encodeGetInputProcessor(1));
  });

  it("refreshes only the confirmed baseline after a partial failure and retains the visible draft", async () => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "setRotation" })
      .mockReturnValueOnce({ error: "denied" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: { ...processor, rotationDegrees: 30 } });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "X軸を反転" }));
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.dirtyRegistration?.dirty).toBe(true));
    expect(rotation).toHaveValue(45);
    expect(screen.getByRole("checkbox", { name: "X軸を反転" })).toBeChecked();
    await mocks.dirtyRegistration?.discard();
    expect(rotation).toHaveValue(30);
    expect(screen.getByRole("checkbox", { name: "X軸を反転" })).not.toBeChecked();
  });

  it("does not let a notification replace a dirty draft", () => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    } satisfies RIP.InputProcessorInfo;
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    act(() => mocks.notification?.(new Uint8Array()));

    expect(rotation).toHaveValue(45);
    expect(mocks.dirtyRegistration?.dirty).toBe(true);
  });

  it.each([
    ["is missing", undefined],
    ["does not match the submitted draft", { rotationDegrees: 30 }],
    ["belongs to another processor", { id: 2 }],
  ])("keeps dirty when the mandatory Get readback %s", async (_name, change) => {
    const processor = {
      id: 1, name: "Trackball", scaleMultiplier: 1, scaleDivisor: 1, rotationDegrees: 0,
      tempLayerEnabled: false, tempLayerLayer: 40, tempLayerActivationDelayMs: 0, tempLayerDeactivationDelayMs: 700,
      activeLayers: 0, axisSnapMode: 0, axisSnapThreshold: 0, axisSnapTimeoutMs: 0,
      xyToScrollEnabled: false, xySwapEnabled: false, xInvert: false, yInvert: false, scrollLayers: 16,
    } satisfies RIP.InputProcessorInfo;
    const invalid = change === undefined ? undefined : { ...processor, ...change, rotationDegrees: "rotationDegrees" in change ? change.rotationDegrees : 45 };
    vi.spyOn(RIP, "decodeNotification").mockReturnValue({ inputProcessorChanged: processor });
    vi.spyOn(RIP, "decodeResponse")
      .mockReturnValueOnce({ responseType: "setRotation" })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: invalid })
      .mockReturnValueOnce({ responseType: "getInputProcessor", getInputProcessor: processor });
    mocks.subsystem!.callRPC.mockResolvedValue(new Uint8Array([1]));
    render(<TrackballSettings />);
    act(() => mocks.notification?.(new Uint8Array()));
    const rotation = screen.getByRole("spinbutton", { name: "度" });
    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.dirtyRegistration?.dirty).toBe(true));
    expect(rotation).toHaveValue(45);
    expect(mocks.toast).toHaveBeenCalledWith("トラックボール設定を保存できませんでした。接続を確認して、もう一度お試しください。", "error");
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

  it("disables a Scroll layer whose index cannot fit in the 32-bit firmware mask", () => {
    mocks.layers = [...mocks.layers, { id: 99, index: 32, name: "Too high", bindings: [] }];
    render(<TrackballSettings />);

    expect(screen.getByRole("option", { name: "Too high (選択不可)" })).toBeDisabled();
  });
});
