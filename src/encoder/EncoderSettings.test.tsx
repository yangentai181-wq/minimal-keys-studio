import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { Writer } from "protobufjs/minimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DirtyRegistration } from "../navigation/DirtyStateContext";
import { ConnectionContext } from "../rpc/ConnectionContext";
import { LockStateContext } from "../rpc/LockStateContext";
import { EncoderSettings } from "./EncoderSettings";
import { ERROR_MESSAGES } from "../copy/errorMessages";

const mocks = vi.hoisted(() => ({
  subsystem: null as { callRPC: ReturnType<typeof vi.fn> } | null,
  registration: undefined as unknown,
  toast: vi.fn(),
  callRpc: vi.fn(),
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => mocks.subsystem,
}));

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: {
    ZMK_STUDIO_CORE_LOCK_STATE_LOCKED: 0,
    ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1,
  },
}));

vi.mock("../rpc/ConnectionContext", async () => {
  const { createContext } = await import("react");
  return { ConnectionContext: createContext({ conn: null }) };
});

vi.mock("../rpc/LockStateContext", async () => {
  const { createContext } = await import("react");
  return { LockStateContext: createContext(0) };
});

vi.mock("../rpc/logging", () => ({
  call_rpc: mocks.callRpc,
}));

vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorList: () => [
    { id: 1, displayName: "Key Press" },
    { id: 11, displayName: "Key Press" },
    { id: 21, displayName: "mouse_scroll" },
  ],
  useBehaviorMap: () => ({}),
}));

vi.mock("../navigation/DirtyStateContext", () => ({
  useDirtyRegistration: (_id: string, registration: unknown) => {
    mocks.registration = registration;
  },
}));

vi.mock("../misc/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../behaviors/BehaviorBindingPicker", () => ({
  BehaviorBindingPicker: ({
    binding,
    onBindingChanged,
  }: {
    binding: BehaviorBinding;
    onBindingChanged: (binding: BehaviorBinding) => void;
  }) => (
    <button
      type="button"
      aria-label={`binding-${binding.behaviorId}`}
      onClick={() =>
        onBindingChanged({
          ...binding,
          behaviorId: binding.behaviorId + 10,
        })
      }
    >
      binding-{binding.behaviorId}
    </button>
  ),
}));

type TestRsrBinding = BehaviorBinding & { tapMs?: number };

function encodeBinding(binding: TestRsrBinding): Uint8Array {
  const writer = Writer.create();
  if (binding.behaviorId !== 0) writer.uint32(8).uint32(binding.behaviorId);
  if ((binding.param1 ?? 0) !== 0) writer.uint32(16).uint32(binding.param1 ?? 0);
  if ((binding.param2 ?? 0) !== 0) writer.uint32(24).uint32(binding.param2 ?? 0);
  if ((binding.tapMs ?? 0) !== 0) writer.uint32(32).uint32(binding.tapMs ?? 0);
  return writer.finish();
}

function sensorsResponse(
  sensorsList: Array<{ index: number; name: string }> = [{ index: 0, name: "Encoder" }],
): Uint8Array {
  const sensors = Writer.create();
  for (const sensor of sensorsList) {
    const encoded = Writer.create()
      .uint32(8).uint32(sensor.index)
      .uint32(18).string(sensor.name)
      .finish();
    sensors.uint32(10).bytes(encoded);
  }
  return Writer.create().uint32(42).bytes(sensors.finish()).finish();
}

function layerBindingsListResponse(
  layers: Array<{ cw: TestRsrBinding; ccw: TestRsrBinding; layerId: number }>,
): Uint8Array {
  const bindings = Writer.create();
  for (const { cw, ccw, layerId } of layers) {
    const layer = Writer.create()
      .uint32(8).uint32(layerId)
      .uint32(18).bytes(encodeBinding(cw))
      .uint32(26).bytes(encodeBinding(ccw))
      .finish();
    bindings.uint32(10).bytes(layer);
  }
  return Writer.create().uint32(34).bytes(bindings.finish()).finish();
}

function layerBindingsResponse(
  cw: TestRsrBinding = { behaviorId: 1, param1: 0, param2: 0 },
  ccw: TestRsrBinding = { behaviorId: 2, param1: 0, param2: 0 },
  layerId = 0,
): Uint8Array {
  return layerBindingsListResponse([{ cw, ccw, layerId }]);
}

function errorResponse(message: string): Uint8Array {
  const error = Writer.create().uint32(10).string(message).finish();
  return Writer.create().uint32(10).bytes(error).finish();
}

function setterResponse(kind: "cw" | "ccw", success: boolean): Uint8Array {
  const response = Writer.create().uint32(8).bool(success).finish();
  return Writer.create().uint32(kind === "cw" ? 18 : 26).bytes(response).finish();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function registration(): DirtyRegistration {
  return mocks.registration as DirtyRegistration;
}

function renderSettings() {
  return render(
    <ConnectionContext.Provider value={{ conn: {} as RpcConnection }}>
      <LockStateContext.Provider value={LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED}>
        <EncoderSettings />
      </LockStateContext.Provider>
    </ConnectionContext.Provider>,
  );
}

describe("EncoderSettings dirty drafts", () => {
  beforeEach(() => {
    mocks.registration = undefined;
    mocks.toast.mockReset();
    mocks.callRpc.mockReset();
    mocks.callRpc.mockResolvedValue({
      keymap: { getKeymap: { layers: [{ id: 0, name: "Base" }] } },
    });
    mocks.subsystem = {
      callRPC: vi.fn()
        .mockResolvedValueOnce(sensorsResponse())
        .mockResolvedValueOnce(layerBindingsResponse()),
    };
  });

  it("registers dirty after editing and discard restores confirmed CW/CCW bindings", async () => {
    renderSettings();

    const cw = await screen.findByRole("button", { name: "binding-1" });
    fireEvent.click(cw);

    await waitFor(() => expect(registration().dirty).toBe(true));
    await act(async () => {
      await expect(registration().discard()).resolves.toBe(true);
    });

    await waitFor(() => expect(registration().dirty).toBe(false));
    expect(screen.getByRole("button", { name: "binding-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "binding-2" })).toBeInTheDocument();
  });

  it("shows saved feedback after both bindings and the refresh succeed", async () => {
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(layerBindingsResponse(
        { behaviorId: 11, param1: 0, param2: 0, tapMs: 5 },
        { behaviorId: 2, param1: 0, param2: 0, tapMs: 5 },
      ));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));
    await act(async () => { await expect(registration().save()).resolves.toBe(true); });

    expect(screen.getByRole("button", { name: "保存済み" })).toBeEnabled();
  });

  it("clears prior saved feedback when the next save fails", async () => {
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(layerBindingsResponse(
        { behaviorId: 11, param1: 0, param2: 0, tapMs: 5 },
        { behaviorId: 2, param1: 0, param2: 0, tapMs: 5 },
      ))
      .mockRejectedValueOnce(new Error("offline"));
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));
    await act(async () => { await expect(registration().save()).resolves.toBe(true); });
    expect(screen.getByRole("button", { name: "保存済み" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "binding-11" }));
    await act(async () => { await expect(registration().save()).rejects.toThrow("offline"); });
    expect(screen.queryByRole("button", { name: "保存済み" })).not.toBeInTheDocument();
  });

  it("does not show saved feedback when the refreshed bindings payload is missing", async () => {
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(new Uint8Array());
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));

    await act(async () => { await expect(registration().save()).rejects.toThrow(); });
    expect(screen.queryByRole("button", { name: "保存済み" })).not.toBeInTheDocument();
  });

  it("rejects mismatched encoder readback and preserves the draft", async () => {
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(layerBindingsResponse());
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));

    await act(async () => { await expect(registration().save()).rejects.toThrow(/readback/i); });

    expect(screen.getByRole("button", { name: "binding-11" })).toBeInTheDocument();
    expect(registration().dirty).toBe(true);
    expect(screen.queryByRole("button", { name: "保存済み" })).not.toBeInTheDocument();
  });

  it("rejects encoder readback missing the selected layer and preserves the draft", async () => {
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(layerBindingsResponse(
        { behaviorId: 11, param1: 0, param2: 0 },
        { behaviorId: 2, param1: 0, param2: 0 },
        1,
      ));
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));

    await act(async () => { await expect(registration().save()).rejects.toThrow(/selected layer/i); });

    expect(screen.getByRole("button", { name: "binding-11" })).toBeInTheDocument();
    expect(registration().dirty).toBe(true);
  });

  it("keeps encoder edits made after submission when matching readback arrives", async () => {
    const readback = deferred<Uint8Array>();
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockImplementationOnce(() => readback.promise);
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));

    let savePromise!: Promise<boolean>;
    await act(async () => { savePromise = registration().save(); });
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(5));
    fireEvent.click(screen.getByRole("button", { name: "binding-11" }));
    await act(async () => {
      readback.resolve(layerBindingsResponse(
        { behaviorId: 11, param1: 0, param2: 0, tapMs: 5 },
        { behaviorId: 2, param1: 0, param2: 0, tapMs: 5 },
      ));
      await expect(savePromise).resolves.toBe(true);
    });

    expect(screen.getByRole("button", { name: "binding-21" })).toBeInTheDocument();
    expect(registration().dirty).toBe(true);
    expect(screen.queryByRole("button", { name: "保存済み" })).not.toBeInTheDocument();
  });

  it("keeps the submitted sensor selected until its deferred save readback finishes", async () => {
    const readback = deferred<Uint8Array>();
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse([
        { index: 0, name: "Encoder A" },
        { index: 1, name: "Encoder B" },
      ]))
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockImplementationOnce(() => readback.promise);
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));

    let savePromise!: Promise<boolean>;
    await act(async () => { savePromise = registration().save(); });
    const otherSensor = await screen.findByRole("button", { name: "Encoder B" });
    await waitFor(() => expect(otherSensor).toBeDisabled());
    fireEvent.click(otherSensor);

    expect(screen.getByText("(Encoder A)")).toBeInTheDocument();
    expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(5);
    await act(async () => {
      readback.resolve(layerBindingsResponse(
        { behaviorId: 11, param1: 0, param2: 0, tapMs: 5 },
        { behaviorId: 2, param1: 0, param2: 0, tapMs: 5 },
      ));
      await expect(savePromise).resolves.toBe(true);
    });

    expect(screen.getByText("(Encoder A)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "binding-11" })).toBeInTheDocument();
    expect(otherSensor).toBeEnabled();
  });

  it("keeps the submitted layer selected until its deferred save readback finishes", async () => {
    const readback = deferred<Uint8Array>();
    const initialBindings = layerBindingsListResponse([
      {
        cw: { behaviorId: 1, param1: 0, param2: 0 },
        ccw: { behaviorId: 2, param1: 0, param2: 0 },
        layerId: 0,
      },
      {
        cw: { behaviorId: 3, param1: 0, param2: 0 },
        ccw: { behaviorId: 4, param1: 0, param2: 0 },
        layerId: 1,
      },
    ]);
    const savedBindings = layerBindingsListResponse([
      {
        cw: { behaviorId: 11, param1: 0, param2: 0, tapMs: 5 },
        ccw: { behaviorId: 2, param1: 0, param2: 0, tapMs: 5 },
        layerId: 0,
      },
      {
        cw: { behaviorId: 3, param1: 0, param2: 0 },
        ccw: { behaviorId: 4, param1: 0, param2: 0 },
        layerId: 1,
      },
    ]);
    mocks.callRpc.mockResolvedValue({
      keymap: { getKeymap: { layers: [{ id: 0, name: "Base" }, { id: 1, name: "Fn" }] } },
    });
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(initialBindings)
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockImplementationOnce(() => readback.promise);
    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));

    let savePromise!: Promise<boolean>;
    await act(async () => { savePromise = registration().save(); });
    const otherLayer = await screen.findByRole("button", { name: "Fn" });
    await waitFor(() => expect(otherLayer).toBeDisabled());
    fireEvent.click(otherLayer);

    expect(screen.getByRole("button", { name: "binding-11" })).toBeInTheDocument();
    await act(async () => {
      readback.resolve(savedBindings);
      await expect(savePromise).resolves.toBe(true);
    });

    expect(screen.getByRole("button", { name: "binding-11" })).toBeInTheDocument();
    expect(otherLayer).toBeEnabled();
  });

  it("keeps the encoder draft dirty when a setter response fails", async () => {
    mocks.subsystem!.callRPC
      .mockResolvedValueOnce(errorResponse("device rejected the binding"))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(layerBindingsResponse());
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));
    await waitFor(() => expect(registration().dirty).toBe(true));

    await act(async () => {
      await expect(registration().save()).rejects.toThrow("device rejected the binding");
    });

    await waitFor(() => expect(registration().dirty).toBe(true));
    expect(screen.getByRole("button", { name: "binding-11" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存済み" })).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(
      ERROR_MESSAGES["encoder.setClockwiseBinding"],
      "error",
    );
  });

  it("uses a 30ms tap for held scroll behaviors", async () => {
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockResolvedValueOnce(layerBindingsResponse())
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", true))
      .mockResolvedValueOnce(layerBindingsResponse(
        { behaviorId: 21, param1: 0, param2: 0, tapMs: 30 },
        { behaviorId: 2, param1: 0, param2: 0, tapMs: 5 },
      ));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));
    fireEvent.click(screen.getByRole("button", { name: "binding-11" }));

    await act(async () => { await expect(registration().save()).resolves.toBe(true); });
    expect(screen.getByRole("button", { name: "保存済み" })).toBeEnabled();
  });

  it("identifies a clockwise binding failure for recovery", async () => {
    mocks.subsystem!.callRPC.mockResolvedValueOnce(setterResponse("cw", false));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));
    await act(async () => {
      await expect(registration().save()).rejects.toThrow("時計回りの設定を保存できませんでした");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      ERROR_MESSAGES["encoder.setClockwiseBinding"],
      "error",
    );
  });

  it("identifies a counter-clockwise binding failure for recovery", async () => {
    mocks.subsystem!.callRPC
      .mockResolvedValueOnce(setterResponse("cw", true))
      .mockResolvedValueOnce(setterResponse("ccw", false));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "binding-1" }));
    await act(async () => {
      await expect(registration().save()).rejects.toThrow("反時計回りの設定を保存できませんでした");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      ERROR_MESSAGES["encoder.setCounterClockwiseBinding"],
      "error",
    );
  });

  it("reapplies a restored encoder snapshot after reconnect discovery resolves", async () => {
    const bindings = deferred<Uint8Array>();
    mocks.subsystem!.callRPC = vi.fn()
      .mockResolvedValueOnce(sensorsResponse())
      .mockImplementationOnce(() => bindings.promise);
    renderSettings();

    await waitFor(() => expect(registration().restore).toBeTypeOf("function"));
    await act(async () => {
      registration().restore?.({
        selectedSensorIndex: 0,
        selectedLayer: 0,
        cwBinding: { behaviorId: 42, param1: 7, param2: 8 },
        ccwBinding: { behaviorId: 43, param1: 9, param2: 10 },
      });
    });
    await act(async () => {
      bindings.resolve(layerBindingsResponse());
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "binding-42" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "binding-43" })).toBeInTheDocument();
    expect(registration().dirty).toBe(true);
  });
});
