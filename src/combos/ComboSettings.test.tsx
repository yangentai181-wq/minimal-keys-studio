import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Writer } from "protobufjs/minimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComboSettings } from "./ComboSettings";

const mocks = vi.hoisted(() => ({
  subsystem: null as { callRPC: ReturnType<typeof vi.fn> } | null,
  toast: vi.fn(),
  callRpc: vi.fn(),
  registration: undefined as { dirty: boolean; save: () => Promise<boolean>; discard: () => Promise<boolean>; snapshot?: () => unknown; restore?: (snapshot: unknown) => void } | undefined,
}));

vi.mock("../rpc/useCustomSubsystem", () => ({ useCustomSubsystem: () => mocks.subsystem }));
vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 1 },
}));
vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../rpc/logging", () => ({ call_rpc: mocks.callRpc }));
vi.mock("../navigation/DirtyStateContext", () => ({
  useDirtyRegistration: (_id: string, registration: typeof mocks.registration) => { mocks.registration = registration; },
}));
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

function getAllResponseFor(combos: Parameters<typeof encodeCombo>[0][]): Uint8Array {
  const inner = Writer.create();
  for (const combo of combos) inner.uint32(10).bytes(encodeCombo(combo));
  return Writer.create().uint32(34).bytes(inner.finish()).finish();
}

function errorResponse(message: string): Uint8Array {
  return Writer.create().uint32(10).bytes(Writer.create().uint32(10).string(message).finish()).finish();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
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

function deleteButton() {
  const button = screen.getAllByRole("button").find((candidate) => candidate.textContent === "");
  expect(button).toBeDefined();
  return button!;
}

function leavesNoSensitiveLogValue(value: unknown): boolean {
  if (value instanceof Uint8Array || Array.isArray(value)) return false;
  if (typeof value === "string") return !["binding", "behaviorId", "param1", "param2", "01070052", "17236050", "13", "18"].some((sensitive) => value.includes(sensitive));
  if (typeof value === "number") return ![1, 13, 18, 17236050].includes(value);
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(([key, nested]) => ["label", "stage", "payloadLength", "responseKind", "errorType"].includes(key) && leavesNoSensitiveLogValue(nested));
}

describe("ComboSettings save confirmation", () => {
  afterEach(() => { vi.useRealTimers(); });
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.callRpc.mockReset();
    mocks.registration = undefined;
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

  it("times out a never-resolving save after 5000ms and clears its timer", async () => {
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockImplementationOnce(() => new Promise<Uint8Array>(() => undefined));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    expect(mocks.toast).toHaveBeenCalledWith("コンボを保存するには、キーボードのFirmware更新が必要です。", "error");
    expect(vi.getTimerCount()).toBe(0);
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

  it.each([
    ["empty response", new Uint8Array()],
    ["success=false", comboResponse("delete", false)],
    ["error response", errorResponse("rejected")],
  ])("keeps a listed combo when delete has %s", async (_name, response) => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    const deleteButton = screen.getAllByRole("button").find((button) => button.textContent === "");
    mocks.subsystem!.callRPC.mockResolvedValueOnce(response);

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

  it("registers a new draft for dirty navigation, restores a deep snapshot, and discards it", async () => {
    renderSettings();
    await beginMissionControlDraft();
    expect(mocks.registration?.dirty).toBe(true);
    const snapshot = mocks.registration?.snapshot?.() as { keyPositions: number[]; binding: { behaviorId: number } };
    snapshot.keyPositions.push(99);
    snapshot.binding.behaviorId = 99;
    mocks.registration?.restore?.({ comboId: 7, keyPositions: [18, 13], timeoutMs: 50, binding: { behaviorId: 1, param1: 0x01070052, param2: 0 }, layerMask: 0, slowRelease: false });
    await waitFor(() => expect(screen.getByText("選択中: 13 + 18")).toBeInTheDocument());
    expect(await mocks.registration?.discard()).toBe(true);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "新規コンボ" })).not.toBeInTheDocument());
  });

  it("normalizes J then F to the exact F/J Mission Control payload", async () => {
    renderSettings();
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "新規コンボ" }));
    fireEvent.click(screen.getByTitle("18"));
    fireEvent.click(screen.getByTitle("13"));
    fireEvent.click(screen.getByRole("button", { name: "Mission Control" }));
    mocks.subsystem!.callRPC.mockResolvedValueOnce(new Uint8Array());

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(2));
    expect([...mocks.subsystem!.callRPC.mock.calls[1][0]]).toEqual([
      10, 19, 10, 17, 8, 1, 16, 13, 16, 18, 24, 50,
      34, 7, 8, 1, 16, 210, 128, 156, 8,
    ]);
  });

  it("ignores a deferred discovery after disconnect and accepts the new subsystem list", async () => {
    const oldDiscovery = deferred<Uint8Array>();
    mocks.subsystem = { callRPC: vi.fn().mockImplementationOnce(() => oldDiscovery.promise) };
    const view = renderSettings();
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(1));
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(false)) };
    view.rerender(<ComboSettings />);
    oldDiscovery.resolve(getAllResponse(true));

    await waitFor(() => expect(screen.getByText(/コンボキーが設定されていません/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps a deferred save draft when the subsystem disconnects", async () => {
    const view = renderSettings();
    await beginMissionControlDraft();
    const pendingSave = deferred<Uint8Array>();
    mocks.subsystem!.callRPC.mockImplementationOnce(() => pendingSave.promise);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    mocks.subsystem = null;
    view.rerender(<ComboSettings />);
    pendingSave.resolve(comboResponse("set", true));

    await waitFor(() => expect(mocks.registration?.dirty).toBe(true));
    expect(mocks.toast).not.toHaveBeenCalledWith("コンボを保存しました", "success");
  });

  it("keeps a restored draft enabled across an old save, reconnect, and late discovery", async () => {
    const oldSave = deferred<Uint8Array>();
    const oldDiscovery = deferred<Uint8Array>();
    const view = renderSettings();
    await beginMissionControlDraft();
    const snapshot = mocks.registration!.snapshot!();
    mocks.subsystem!.callRPC.mockImplementationOnce(() => oldSave.promise);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled());

    await act(async () => {
      mocks.subsystem = null;
      view.rerender(<ComboSettings />);
      mocks.subsystem = { callRPC: vi.fn().mockImplementationOnce(() => oldDiscovery.promise) };
      view.rerender(<ComboSettings />);
      mocks.registration!.restore!(snapshot);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());

    await act(async () => { oldSave.resolve(comboResponse("set", true)); oldDiscovery.resolve(getAllResponse(false)); });
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
    expect(screen.getByRole("heading", { name: "新規コンボ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps a deep dirty snapshot isolated and restores every editable draft field after remount", async () => {
    const view = renderSettings();
    await beginMissionControlDraft();
    const snapshot = mocks.registration!.snapshot!() as { comboId: number; keyPositions: number[]; timeoutMs: number; binding: { behaviorId: number; param1: number; param2: number }; layerMask: number; slowRelease: boolean };
    snapshot.comboId = 99; snapshot.keyPositions.splice(0, 2, 0, 1); snapshot.timeoutMs = 77;
    snapshot.binding.behaviorId = 99; snapshot.binding.param1 = 99; snapshot.binding.param2 = 99; snapshot.layerMask = 99; snapshot.slowRelease = true;
    expect(screen.getByText("選択中: 13 + 18")).toBeInTheDocument();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("50");

    const saved = mocks.registration!.snapshot!();
    view.unmount();
    renderSettings();
    await waitFor(() => expect(mocks.registration).toBeDefined());
    mocks.registration!.restore!(saved);
    await waitFor(() => expect(screen.getByText("選択中: 13 + 18")).toBeInTheDocument());
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("50");
    expect(await mocks.registration!.discard()).toBe(true);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "新規コンボ" })).not.toBeInTheDocument());
  });

  it("returns false without closing a re-edited draft after submitted readback refreshes the list", async () => {
    renderSettings();
    await beginMissionControlDraft();
    const set = deferred<Uint8Array>();
    const readback = deferred<Uint8Array>();
    mocks.subsystem!.callRPC.mockImplementationOnce(() => set.promise).mockImplementationOnce(() => readback.promise);
    const result = mocks.registration!.save();
    await waitFor(() => expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled());
    set.resolve(comboResponse("set", true));
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(3));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "60" } });
    readback.resolve(getAllResponse(true));

    await expect(result).resolves.toBe(false);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
    expect(screen.getByText("50ms")).toBeInTheDocument();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("60");
    expect(mocks.toast).not.toHaveBeenCalledWith("コンボを保存しました", "success");
  });

  it("requires comboId equality, accepts reverse readback keys, and replaces the list on confirmed save", async () => {
    renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockResolvedValueOnce(comboResponse("set", true)).mockResolvedValueOnce(getAllResponse(true, { comboId: 2, keys: [18, 13] }));
    const failed = mocks.registration!.save();
    await expect(failed).resolves.toBe(false);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();

    mocks.subsystem!.callRPC.mockResolvedValueOnce(comboResponse("set", true)).mockResolvedValueOnce(getAllResponseFor([{ keys: [18, 13] }, { comboId: 2, keys: [0, 1] }]));
    await expect(mocks.registration!.save()).resolves.toBe(true);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "編集" })).toHaveLength(2));
  });

  it("times out a pending delete without losing its list card or open edit form", async () => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    mocks.subsystem!.callRPC.mockImplementationOnce(() => new Promise<Uint8Array>(() => undefined));
    vi.useFakeTimers();
    fireEvent.click(deleteButton());
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.toast).toHaveBeenCalledWith("コンボを保存するには、キーボードのFirmware更新が必要です。", "error");
    expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "コンボを編集" })).toBeInTheDocument();
  });

  it("ignores a deferred delete response after reconnect without changing the replacement list", async () => {
    const oldDelete = deferred<Uint8Array>();
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    const view = renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    mocks.subsystem!.callRPC.mockImplementationOnce(() => oldDelete.promise);
    fireEvent.click(deleteButton());
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(2));

    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true, { comboId: 2, keys: [0, 1] })) };
    view.rerender(<ComboSettings />);
    await waitFor(() => expect(screen.getByText("0 + 1")).toBeInTheDocument());
    await act(async () => { oldDelete.resolve(comboResponse("delete", true)); });
    await waitFor(() => expect(screen.getByText("0 + 1")).toBeInTheDocument());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("clears timeout timers after early save success and explicit delete rejection", async () => {
    renderSettings();
    await beginMissionControlDraft();
    vi.useFakeTimers();
    mocks.subsystem!.callRPC.mockResolvedValueOnce(comboResponse("set", true)).mockResolvedValueOnce(getAllResponse(true));
    await expect(mocks.registration!.save()).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    mocks.subsystem!.callRPC.mockRejectedValueOnce(new Error("delete rejected"));
    await act(async () => { fireEvent.click(deleteButton()); await Promise.resolve(); });
    expect(mocks.toast).toHaveBeenCalledWith("コンボの削除に失敗しました", "error");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never logs combo binding fields, byte arrays, or fixture-sensitive values on every RPC outcome", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem!.callRPC.mockResolvedValueOnce(new Uint8Array());
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(error).toHaveBeenCalled());
    first.unmount();

    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    const second = renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    mocks.subsystem!.callRPC.mockResolvedValueOnce(comboResponse("delete", false));
    fireEvent.click(deleteButton());
    await waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    second.unmount();

    mocks.subsystem = { callRPC: vi.fn().mockRejectedValue(new Error("discovery failed")) };
    renderSettings();
    await waitFor(() => expect(error).toHaveBeenCalledTimes(3));
    const allLogs = [...info.mock.calls, ...error.mock.calls];
    expect(allLogs.length).toBeGreaterThan(0);
    for (const call of allLogs) for (const argument of call) expect(leavesNoSensitiveLogValue(argument)).toBe(true);
    expect(leavesNoSensitiveLogValue(17236050)).toBe(false);
    expect(leavesNoSensitiveLogValue("01070052")).toBe(false);
    expect(leavesNoSensitiveLogValue({ payloadLength: 21, behaviorId: 1 })).toBe(false);
    expect(leavesNoSensitiveLogValue(new Uint8Array([10, 19]))).toBe(false);
    info.mockRestore(); error.mockRestore();
  });

  it("lets a current discovery clear loading while a current save completes on the same subsystem", async () => {
    const discovery = deferred<Uint8Array>();
    const set = deferred<Uint8Array>();
    const readback = deferred<Uint8Array>();
    const view = renderSettings();
    await beginMissionControlDraft();
    mocks.subsystem = { callRPC: vi.fn().mockImplementationOnce(() => discovery.promise).mockImplementationOnce(() => set.promise).mockImplementationOnce(() => readback.promise) };
    view.rerender(<ComboSettings />);
    await waitFor(() => expect(screen.getByText("読み込み中...")).toBeInTheDocument());

    const saved = mocks.registration!.save();
    await waitFor(() => expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled());
    await act(async () => { set.resolve(comboResponse("set", true)); discovery.resolve(getAllResponse(false)); });
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(3));
    await act(async () => { readback.resolve(getAllResponse(true, { keys: [18, 13] })); });

    await expect(saved).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "新規コンボ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument();
  });

  it("lets a current discovery clear loading while a current delete completes on the same subsystem", async () => {
    const discovery = deferred<Uint8Array>();
    const deletion = deferred<Uint8Array>();
    const readback = deferred<Uint8Array>();
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true)) };
    const view = renderSettings();
    await waitFor(() => expect(screen.getByRole("button", { name: "編集" })).toBeInTheDocument());
    mocks.subsystem = { callRPC: vi.fn().mockImplementationOnce(() => discovery.promise).mockImplementationOnce(() => deletion.promise).mockImplementationOnce(() => readback.promise) };
    view.rerender(<ComboSettings />);
    await waitFor(() => expect(screen.getByText("読み込み中...")).toBeInTheDocument());
    fireEvent.click(deleteButton());
    await act(async () => { deletion.resolve(comboResponse("delete", true)); discovery.resolve(getAllResponse(true)); });
    await waitFor(() => expect(mocks.subsystem!.callRPC).toHaveBeenCalledTimes(3));
    await act(async () => { readback.resolve(getAllResponse(false)); });

    await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith("コンボを削除しました", "success");
  });

  it("keeps snapshot and restored binding fields isolated from caller mutation", async () => {
    renderSettings();
    await beginMissionControlDraft();
    const first = mocks.registration!.snapshot!() as { comboId: number; keyPositions: number[]; timeoutMs: number; binding: { behaviorId: number; param1: number; param2: number }; layerMask: number; slowRelease: boolean };
    first.binding.behaviorId = 99; first.binding.param1 = 99; first.binding.param2 = 99;
    const second = mocks.registration!.snapshot!() as typeof first;
    expect(second).toEqual({ comboId: 1, keyPositions: [13, 18], timeoutMs: 50, binding: { behaviorId: 1, param1: 17236050, param2: 0 }, layerMask: 0, slowRelease: false });

    const restore = { comboId: 7, keyPositions: [18, 13], timeoutMs: 70, binding: { behaviorId: 3, param1: 4, param2: 5 }, layerMask: 6, slowRelease: true };
    await act(async () => { mocks.registration!.restore!(restore); });
    restore.keyPositions[0] = 0; restore.binding.behaviorId = 99; restore.binding.param1 = 99; restore.binding.param2 = 99; restore.timeoutMs = 99; restore.layerMask = 99; restore.slowRelease = false;
    const restored = mocks.registration!.snapshot!() as typeof first;
    expect(restored).toEqual({ comboId: 7, keyPositions: [18, 13], timeoutMs: 70, binding: { behaviorId: 3, param1: 4, param2: 5 }, layerMask: 6, slowRelease: true });
  });

  it("replaces stale discovery cards with only confirmed save readback cards", async () => {
    mocks.subsystem = { callRPC: vi.fn().mockResolvedValue(getAllResponse(true, { comboId: 7, keys: [0, 1], timeoutMs: 99 })) };
    renderSettings();
    await waitFor(() => expect(screen.getByText("0 + 1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "新規コンボ" }));
    fireEvent.click(screen.getByTitle("13")); fireEvent.click(screen.getByTitle("18")); fireEvent.click(screen.getByRole("button", { name: "Mission Control" }));
    mocks.subsystem!.callRPC.mockResolvedValueOnce(comboResponse("set", true)).mockResolvedValueOnce(getAllResponse(true, { comboId: 8, keys: [18, 13] }));
    await expect(mocks.registration!.save()).resolves.toBe(true);
    await waitFor(() => expect(screen.getByText("18 + 13")).toBeInTheDocument());
    expect(screen.queryByText("0 + 1")).not.toBeInTheDocument();
    expect(screen.queryByText("99ms")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "編集" })).toHaveLength(1);
  });
});
