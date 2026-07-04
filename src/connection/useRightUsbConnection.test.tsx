import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { RawHidSubscription } from "./rawHid";
import { useRightUsbConnection } from "./useRightUsbConnection";

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
