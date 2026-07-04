import { afterEach, describe, expect, it, vi } from "vitest";
import type { RpcConnection, RequestResponse } from "@zmkfirmware/zmk-studio-ts-client";
import {
  DeviceInfoRequestError,
  DeviceInfoTimeoutError,
  requestDeviceInfo,
} from "./deviceInfo";

const conn = {} as RpcConnection;

afterEach(() => {
  vi.useRealTimers();
});

describe("requestDeviceInfo", () => {
  it("returns device info when the keyboard responds", async () => {
    const response: RequestResponse = {
      requestId: 0,
      core: {
        getDeviceInfo: {
          name: "minimal-keys",
          serialNumber: new Uint8Array([1, 2, 3]),
        },
      },
    };
    const call = vi.fn().mockResolvedValue(response);

    await expect(requestDeviceInfo(conn, 5000, call)).resolves.toEqual(
      response.core?.getDeviceInfo,
    );
    expect(call).toHaveBeenCalledWith(conn, { core: { getDeviceInfo: true } });
  });

  it("waits for the configured timeout before reporting no device response", async () => {
    vi.useFakeTimers();
    const call = vi.fn(() => new Promise<RequestResponse>(() => {}));

    const result = requestDeviceInfo(conn, 5000, call).catch((error) => error);
    await vi.advanceTimersByTimeAsync(4999);

    let settled = false;
    result.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    const error = await result;
    expect(error).toBeInstanceOf(DeviceInfoTimeoutError);
    expect(error).toHaveProperty(
      "message",
      expect.stringContaining("キーボードから応答がありません"),
    );
  });

  it("suggests BLE when USB serial opens but the keyboard does not answer", async () => {
    vi.useFakeTimers();
    const call = vi.fn(() => new Promise<RequestResponse>(() => {}));

    const result = requestDeviceInfo(conn, 5000, call, {
      transport: "usb",
    }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(5000);

    const error = await result;
    expect(error.message).toContain("USBシリアル");
    expect(error.message).toContain("BLE");
  });

  it("keeps BLE timeout guidance specific to wireless connections", async () => {
    vi.useFakeTimers();
    const call = vi.fn(() => new Promise<RequestResponse>(() => {}));

    const result = requestDeviceInfo(conn, 8000, call, {
      transport: "ble",
    }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(8000);

    const error = await result;
    expect(error.message).toContain("BLE接続");
    expect(error.message).not.toContain("USBケーブル");
  });

  it("wraps rpc failures in a user-facing initialization error", async () => {
    const call = vi.fn().mockRejectedValue(new Error("No RPC response received"));
    const result = requestDeviceInfo(conn, 5000, call);

    await expect(result).rejects.toBeInstanceOf(DeviceInfoRequestError);
    await expect(result).rejects.toThrow(
      "キーボードとの初期通信に失敗しました",
    );
  });

  it("reports when the response does not include device info", async () => {
    const call = vi.fn().mockResolvedValue({ requestId: 0 } satisfies RequestResponse);

    await expect(requestDeviceInfo(conn, 5000, call)).rejects.toThrow(
      "キーボードからデバイス情報が返りませんでした",
    );
  });
});
