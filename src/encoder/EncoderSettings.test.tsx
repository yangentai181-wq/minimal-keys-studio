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
  useBehaviorList: () => [{ id: 1, displayName: "Key Press" }],
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

function encodeBinding(binding: BehaviorBinding): Uint8Array {
  const writer = Writer.create();
  if (binding.behaviorId !== 0) writer.uint32(8).uint32(binding.behaviorId);
  if ((binding.param1 ?? 0) !== 0) writer.uint32(16).uint32(binding.param1 ?? 0);
  if ((binding.param2 ?? 0) !== 0) writer.uint32(24).uint32(binding.param2 ?? 0);
  return writer.finish();
}

function sensorsResponse(): Uint8Array {
  const sensor = Writer.create().uint32(8).uint32(0).uint32(18).string("Encoder").finish();
  const sensors = Writer.create().uint32(10).bytes(sensor).finish();
  return Writer.create().uint32(42).bytes(sensors).finish();
}

function layerBindingsResponse(
  cw: BehaviorBinding = { behaviorId: 1, param1: 0, param2: 0 },
  ccw: BehaviorBinding = { behaviorId: 2, param1: 0, param2: 0 },
): Uint8Array {
  const layer = Writer.create()
    .uint32(8).uint32(0)
    .uint32(18).bytes(encodeBinding(cw))
    .uint32(26).bytes(encodeBinding(ccw))
    .finish();
  const bindings = Writer.create().uint32(10).bytes(layer).finish();
  return Writer.create().uint32(34).bytes(bindings).finish();
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
    expect(mocks.toast).toHaveBeenCalledWith(
      ERROR_MESSAGES["encoder.setClockwiseBinding"],
      "error",
    );
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
