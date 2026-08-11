import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Writer } from "protobufjs/minimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceSettings } from "./DeviceSettings";

const mocks = vi.hoisted(() => ({
  callRPC: vi.fn(),
  toast: vi.fn(),
  notification: undefined as undefined | ((payload: Uint8Array) => void),
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => ({ subsystemIndex: 1, callRPC: mocks.callRPC }),
  useCustomNotification: (_index: number | undefined, callback: (payload: Uint8Array) => void) => {
    mocks.notification = callback;
  },
}));
vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../telemetry/TelemetryProvider", () => ({ useTelemetry: () => ({ isOptedIn: false, setOptedIn: vi.fn() }) }));

describe("DeviceSettings", () => {
  beforeEach(() => { mocks.callRPC.mockReset(); mocks.toast.mockReset(); mocks.notification = undefined; });

  function response(kind: "set" | "getAll", success: boolean): Uint8Array {
    const inner = Writer.create().uint32(8).bool(success).finish();
    return Writer.create().uint32(kind === "set" ? 26 : 34).bytes(inner).finish();
  }

  function errorResponse(message: string): Uint8Array {
    const error = Writer.create().uint32(10).string(message).finish();
    return Writer.create().uint32(10).bytes(error).finish();
  }

  function activityNotification(idleSeconds: number, sleepMinutes: number, source: number): Uint8Array {
    const settings = Writer.create()
      .uint32(8).uint32(idleSeconds * 1000)
      .uint32(16).uint32(sleepMinutes * 60000)
      .uint32(24).uint32(source)
      .finish();
    const notification = Writer.create().uint32(10).bytes(settings).finish();
    return Writer.create().uint32(10).bytes(notification).finish();
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
    return { promise, resolve };
  }

  it("shows applied feedback only after setting and refresh both succeed", async () => {
    mocks.callRPC.mockResolvedValueOnce(response("set", true)).mockResolvedValueOnce(response("getAll", true));
    render(<DeviceSettings />);
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    expect(await screen.findByRole("button", { name: "適用済み" })).toBeEnabled();
  });

  it("does not show applied feedback when refresh fails", async () => {
    mocks.callRPC.mockResolvedValueOnce(response("set", true)).mockRejectedValueOnce(new Error("offline"));
    render(<DeviceSettings />);
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
  });

  it("clears prior applied feedback when the next apply fails", async () => {
    mocks.callRPC.mockResolvedValueOnce(response("set", true)).mockResolvedValueOnce(response("getAll", true));
    render(<DeviceSettings />);
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    expect(await screen.findByRole("button", { name: "適用済み" })).toBeEnabled();

    mocks.callRPC.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "適用済み" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
  });

  it("rejects a false set acknowledgement and retains the draft", async () => {
    mocks.callRPC.mockResolvedValueOnce(response("set", false));
    render(<DeviceSettings />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(45);
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
    expect(mocks.callRPC).toHaveBeenCalledOnce();
  });

  it("rejects a false get-all acknowledgement and retains the draft", async () => {
    mocks.callRPC
      .mockResolvedValueOnce(response("set", true))
      .mockResolvedValueOnce(response("getAll", false));
    render(<DeviceSettings />);
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(20);
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
  });

  it("rejects an RPC error response", async () => {
    mocks.callRPC.mockResolvedValueOnce(errorResponse("device rejected settings"));
    render(<DeviceSettings />);
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
  });

  it("does not let a stale apply completion or notification overwrite a newer draft", async () => {
    const setResult = deferred<Uint8Array>();
    mocks.callRPC
      .mockReturnValueOnce(setResult.promise)
      .mockResolvedValueOnce(response("getAll", true));
    render(<DeviceSettings />);
    const idleInput = screen.getAllByRole("spinbutton")[0];
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    fireEvent.change(idleInput, { target: { value: "45" } });
    await act(async () => { mocks.notification?.(activityNotification(30, 15, 0)); });
    await act(async () => { setResult.resolve(response("set", true)); });

    expect(idleInput).toHaveValue(45);
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
    expect(screen.queryByText("設定を適用しました")).not.toBeInTheDocument();
  });

  it("requires explicit acknowledgements when syncing all devices", async () => {
    mocks.callRPC
      .mockResolvedValueOnce(response("set", true))
      .mockResolvedValueOnce(response("set", false));
    render(<DeviceSettings />);
    await act(async () => {
      mocks.notification?.(activityNotification(30, 15, 0));
      mocks.notification?.(activityNotification(45, 20, 1));
    });
    fireEvent.click(screen.getByRole("button", { name: "全デバイスに同期" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.queryByText("全デバイスに同期しました")).not.toBeInTheDocument();
    expect(mocks.callRPC).toHaveBeenCalledTimes(2);
  });
});
