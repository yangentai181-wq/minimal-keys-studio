import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Writer } from "protobufjs/minimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComboSettings } from "./ComboSettings";

const mocks = vi.hoisted(() => ({
  subsystem: null as { callRPC: ReturnType<typeof vi.fn> } | null,
  toast: vi.fn(),
  callRpc: vi.fn(),
}));

vi.mock("../rpc/useCustomSubsystem", () => ({ useCustomSubsystem: () => mocks.subsystem }));
vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1 },
}));
vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../rpc/logging", () => ({ call_rpc: mocks.callRpc }));
vi.mock("../behaviors/BehaviorsContext", () => ({
  useBehaviorList: () => [{ id: 1, displayName: "Key Press", metadata: [] }],
}));
vi.mock("../behaviors/BehaviorBindingPicker", () => ({
  BehaviorBindingPicker: ({ onBindingChanged }: { onBindingChanged: (binding: { behaviorId: number; param1: number; param2: number }) => void }) => (
    <button onClick={() => onBindingChanged({ behaviorId: 1, param1: 0x01070052, param2: 0 })}>Mission Control</button>
  ),
}));

function comboResponse(kind: "set" | "delete", success: boolean): Uint8Array {
  const inner = Writer.create().uint32(8).bool(success).finish();
  return Writer.create().uint32(kind === "set" ? 18 : 26).bytes(inner).finish();
}

function encodeCombo(overrides: Partial<{ comboId: number; keys: number[]; behaviorId: number; param1: number; param2: number; timeoutMs: number; layerMask: number; slowRelease: boolean }> = {}): Uint8Array {
  const config = { comboId: 1, keys: [13, 18], behaviorId: 1, param1: 0x01070052, param2: 0, timeoutMs: 50, layerMask: 0, slowRelease: false, ...overrides };
  const binding = Writer.create().uint32(8).uint32(config.behaviorId).uint32(16).uint32(config.param1).uint32(24).uint32(config.param2).finish();
  const writer = Writer.create().uint32(8).uint32(config.comboId);
  for (const key of config.keys) writer.uint32(16).uint32(key);
  return writer.uint32(24).uint32(config.timeoutMs).uint32(34).bytes(binding)
    .uint32(40).uint32(config.layerMask).uint32(48).bool(config.slowRelease).finish();
}

function getAllResponse(present = true, overrides?: Parameters<typeof encodeCombo>[0]): Uint8Array {
  const inner = present ? Writer.create().uint32(10).bytes(encodeCombo(overrides)).finish() : new Uint8Array();
  return Writer.create().uint32(34).bytes(inner).finish();
}

function errorResponse(message: string): Uint8Array {
  return Writer.create().uint32(10).bytes(Writer.create().uint32(10).string(message).finish()).finish();
}

function renderSettings() {
  return render(<ComboSettings />);
}

async function beginMissionControlDraft() {
  await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(1));
  fireEvent.click(await screen.findByRole("button", { name: "新規コンボ" }));
  fireEvent.click(screen.getByTitle("13"));
  fireEvent.click(screen.getByTitle("18"));
  fireEvent.click(screen.getByRole("button", { name: "Mission Control" }));
}

describe("ComboSettings save confirmation", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.callRpc.mockReset();
    mocks.callRpc.mockResolvedValue({ keymap: { getKeymap: { layers: [] } } });
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(false)) };
  });

  it("keeps the F/J Mission Control form open when setCombo has an empty response", async () => {
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockResolvedValueOnce(new Uint8Array());

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "新規コンボ" })).toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith("コンボの保存に失敗しました", "error");
  });

  it("closes the form only after an explicit set success and matching readback", async () => {
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC
      .mockResolvedValueOnce(comboResponse("set", true))
      .mockResolvedValueOnce(getAllResponse(true));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "新規コンボ" })).not.toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith("コンボを保存しました", "success");
  });

  it.each([
    ["success=false", () => comboResponse("set", false), "コンボの保存に失敗しました"],
    ["response error", () => errorResponse("rejected"), "コンボの保存に失敗しました"],
    ["missing combo", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", false],
    ["keys differ", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { keys: [13, 19] }],
    ["binding id differs", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { behaviorId: 2 }],
    ["binding param1 differs", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { param1: 1 }],
    ["binding param2 differs", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { param2: 1 }],
    ["timeout differs", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { timeoutMs: 51 }],
    ["layer mask differs", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { layerMask: 1 }],
    ["slow release differs", () => comboResponse("set", true), "コンボの保存を確認できませんでした。編集内容は保持されています。", { slowRelease: true }],
  ])("keeps the draft when %s", async (_name, setResponse, expectedToast, readbackOverrides = undefined) => {
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockResolvedValueOnce(setResponse());
    if (readbackOverrides !== undefined) {
      const fixtureOverrides = typeof readbackOverrides === "object" ? readbackOverrides : undefined;
      mocks.subsystem!.callRPC.mockResolvedValueOnce(getAllResponse(readbackOverrides !== false, fixtureOverrides));
    }

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "新規コンボ" })).toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith(expectedToast, "error");
  });

  it("keeps the draft and gives Firmware guidance after a save timeout", async () => {
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockRejectedValueOnce(new Error("RPC timeout: setCombo"));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("コンボを保存するには、キーボードのFirmware更新が必要です。", "error"));
    expect(screen.getByRole("heading", { name: "新規コンボ" })).toBeInTheDocument();
  });

  it("confirms deletion only when explicit success is followed by an absent readback", async () => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    const deleteButton = screen.getAllByRole("button").find((button) => button.textContent === "");
    expect(deleteButton).toBeDefined();
    mocks.subsystem!.callRPC
      .mockResolvedValueOnce(comboResponse("delete", true))
      .mockResolvedValueOnce(getAllResponse(false));

    fireEvent.click(deleteButton!);

    await waitFor(() => expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument());
    expect(mocks.toast).toHaveBeenCalledWith("コンボを削除しました", "success");
  });

  it("keeps a listed combo when deletion is not confirmed by readback", async () => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    const deleteButton = screen.getAllByRole("button").find((button) => button.textContent === "");
    mocks.subsystem!.callRPC
      .mockResolvedValueOnce(comboResponse("delete", true))
      .mockResolvedValueOnce(getAllResponse(true));

    fireEvent.click(deleteButton!);

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("コンボの削除に失敗しました", "error"));
    expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
  });

  it("logs save payload length and stages without logging binding values", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockResolvedValueOnce(new Uint8Array());

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(info).toHaveBeenCalledWith("[Combos] RPC", { label: "setCombo", stage: "request", payloadLength: 21 }));
    const setRequest = info.mock.calls.find(([, detail]) => (detail as { label?: string }).label === "setCombo")?.[1];
    expect(setRequest).not.toHaveProperty("binding");
    info.mockRestore();
  });
});
