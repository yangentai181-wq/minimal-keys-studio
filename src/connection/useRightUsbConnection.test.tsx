import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { RawHidSubscription } from "./rawHid";
import {
  connectTauriSerialDevice,
  useRightUsbConnection,
} from "./useRightUsbConnection";

const { tauriListDevicesMock, tauriSerialConnectMock } = vi.hoisted(() => ({
  tauriListDevicesMock: vi.fn(),
  tauriSerialConnectMock: vi.fn(),
}));

vi.mock("../tauri/serial", () => ({
  list_devices: tauriListDevicesMock,
  connect: tauriSerialConnectMock,
}));

const connectRawHidMonitorMock = vi.fn<
  (onFrame: unknown) => Promise<RawHidSubscription | undefined>
>();

vi.mock("./rawHid", async (importOriginal) => {
  const original = await importOriginal<typeof import("./rawHid")>();
  return {
    ...original,
    connectRawHidMonitor: (onFrame: unknown) =>
      connectRawHidMonitorMock(onFrame),
  };
});

vi.mock("./usbDiagnostics", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./usbDiagnostics")>();
  return {
    ...original,
    detectRightUsbDevice: vi.fn(async () => ({
      hidDevices: [],
      serialPorts: [],
      rawHidVisible: true,
      serialVisible: true,
    })),
    logRightUsbDetection: vi.fn(),
  };
});

vi.mock("../transport/serial", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../transport/serial")>();
  return {
    ...original,
    connect: vi.fn(async () => {
      throw new Error("serial not under test");
    }),
  };
});

describe("useRightUsbConnection monitor open/close race", () => {
  it("rejects ambiguous native serial candidates without opening either device", async () => {
    tauriListDevicesMock.mockResolvedValue([
      { id: "right", label: "right keyboard" },
      { id: "other", label: "other keyboard" },
    ]);

    await expect(connectTauriSerialDevice()).rejects.toThrow(
      "複数のUSBシリアルデバイス",
    );
    expect(tauriSerialConnectMock).not.toHaveBeenCalled();
  });

  it("clears the monitor contract when the native reader reports a failure", async () => {
    let reportFailure: ((reason: string) => void) | undefined;
    const subscription: RawHidSubscription = {
      device: {} as RawHidSubscription["device"],
      close: vi.fn(async () => {}),
    };
    const { result } = renderHook(() =>
      useRightUsbConnection({
        probeStudioRpc: vi.fn(async () => {}),
        platform: {
          connectMonitor: vi.fn(async (_onFrame, onError) => {
            reportFailure = onError;
            return subscription;
          }),
          detect: vi.fn(async () => ({
            hidDevices: [], serialPorts: [], rawHidVisible: true, serialVisible: true,
          })),
          logDetection: vi.fn(),
          openSerialTransport: vi.fn(async () => { throw new Error("not under test"); }),
        },
      }),
    );

    await act(async () => { await result.current.connectRightUsb(); });
    act(() => reportFailure?.("device lost"));

    await waitFor(() => expect(result.current.monitorActive).toBe(false));
    expect(result.current.state.detail).toBe("device lost");
  });

  it("uses an injected native monitor operation for the right-USB flow", async () => {
    const subscription: RawHidSubscription = {
      device: {} as RawHidSubscription["device"],
      close: vi.fn(async () => {}),
    };
    const connectMonitor = vi.fn(async () => subscription);
    const detect = vi.fn(async () => ({
      hidDevices: [],
      serialPorts: [],
      rawHidVisible: true,
      serialVisible: true,
    }));

    const { result } = renderHook(() =>
      useRightUsbConnection({
        probeStudioRpc: vi.fn(async () => {}),
        platform: {
          connectMonitor,
          detect,
          logDetection: vi.fn(),
          openSerialTransport: vi.fn(async () => {
            throw new Error("serial not under test");
          }),
        },
      }),
    );

    await act(async () => {
      await result.current.connectRightUsb();
    });

    expect(connectMonitor).toHaveBeenCalledOnce();
    expect(detect).toHaveBeenCalledOnce();
    expect(result.current.monitorActive).toBe(true);
  });

  it("closes a subscription that resolves after closeMonitor instead of leaking it", async () => {
    let resolveMonitor:
      | ((subscription: RawHidSubscription) => void)
      | undefined;
    const close = vi.fn(async () => {});
    const subscription: RawHidSubscription = {
      device: {} as RawHidSubscription["device"],
      close,
    };
    connectRawHidMonitorMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMonitor = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useRightUsbConnection({ probeStudioRpc: vi.fn(async () => {}) }),
    );

    // Start the flow; openMonitor is now pending on the WebHID picker.
    let flowPromise: Promise<void>;
    act(() => {
      flowPromise = result.current.connectRightUsb();
    });
    await waitFor(() => {
      expect(connectRawHidMonitorMock).toHaveBeenCalledTimes(1);
    });

    // User closes the monitor while the open is still in flight.
    await act(async () => {
      await result.current.closeMonitor();
    });
    expect(close).not.toHaveBeenCalled();

    // The late open resolves: it must be closed immediately, not adopted.
    await act(async () => {
      resolveMonitor?.(subscription);
      await flowPromise!;
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.monitorActive).toBe(false);
    expect(result.current.state.contracts.rawHidMonitor).toBe(false);
  });

  it("adopts the subscription normally when no close happens mid-open", async () => {
    const close = vi.fn(async () => {});
    const subscription: RawHidSubscription = {
      device: {} as RawHidSubscription["device"],
      close,
    };
    connectRawHidMonitorMock.mockImplementation(async () => subscription);

    const { result } = renderHook(() =>
      useRightUsbConnection({ probeStudioRpc: vi.fn(async () => {}) }),
    );

    await act(async () => {
      await result.current.connectRightUsb();
    });

    expect(close).not.toHaveBeenCalled();
    expect(result.current.state.contracts.rawHidMonitor).toBe(true);
  });
});
