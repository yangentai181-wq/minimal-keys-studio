import { describe, expect, it, vi } from "vitest";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

import {
  initialCoordinatorState,
  reduceConnection,
  type CoordinatorEvent,
  type CoordinatorState,
} from "./coordinator";
import { runRightUsbFlow, type RightUsbFlowDeps } from "./rightUsbFlow";
import type { RawHidSubscription } from "./rawHid";
import type { RightUsbDetection } from "./usbDiagnostics";
import { DeviceInfoTimeoutError } from "../rpc/deviceInfo";
import { SerialPortBusyError } from "../transport/serial";

const detection: RightUsbDetection = {
  hidDevices: [
    {
      source: "webhid",
      vendorId: 0x1d50,
      productId: 0x615e,
      productName: "minimal-keys",
    },
  ],
  serialPorts: [
    { source: "webserial", vendorId: 0x1d50, productId: 0x615e },
  ],
  rawHidVisible: true,
  serialVisible: true,
};

const monitorSubscription: RawHidSubscription = {
  device: {} as RawHidSubscription["device"],
  close: async () => {},
};

const fakeTransport = {} as RpcTransport;

function makeDeps(overrides: Partial<RightUsbFlowDeps> = {}) {
  const events: CoordinatorEvent[] = [];
  const deps: RightUsbFlowDeps = {
    dispatch: (event) => events.push(event),
    detect: vi.fn(async () => detection),
    openMonitor: vi.fn(async () => monitorSubscription),
    openSerialTransport: vi.fn(async () => fakeTransport),
    probeStudioRpc: vi.fn(async () => {}),
    ...overrides,
  };
  const finalState = () =>
    events.reduce(reduceConnection, initialCoordinatorState);
  return { deps, events, finalState };
}

function phaseOf(state: CoordinatorState) {
  return state.phase;
}

describe("runRightUsbFlow", () => {
  it("establishes both contracts on the happy path", async () => {
    const { deps, finalState } = makeDeps();
    const result = await runRightUsbFlow(deps);

    expect(result.editorReady).toBe(true);
    expect(result.monitor).toBe(monitorSubscription);
    const state = finalState();
    expect(phaseOf(state)).toBe("studio_rpc_ready");
    expect(state.contracts).toEqual({
      rawHidMonitor: true,
      studioRpc: true,
      studioTransport: "usb",
    });
  });

  it("starts the monitor even when Studio RPC never answers (WebHID without RPC)", async () => {
    const { deps, finalState } = makeDeps({
      probeStudioRpc: vi.fn(async () => {
        throw new DeviceInfoTimeoutError(5000, "usb");
      }),
    });

    const result = await runRightUsbFlow(deps);

    expect(result.monitor).toBe(monitorSubscription);
    expect(result.editorReady).toBe(false);
    const state = finalState();
    // Serial opened but the RPC contract failed → degraded, monitor kept.
    expect(phaseOf(state)).toBe("serial_open_but_rpc_unavailable");
    expect(state.contracts.rawHidMonitor).toBe(true);
    expect(state.contracts.studioRpc).toBe(false);
  });

  it("maps a held serial port to busy_or_already_open", async () => {
    const { deps, finalState } = makeDeps({
      openSerialTransport: vi.fn(async () => {
        throw new SerialPortBusyError("USBポートを開けませんでした。");
      }),
    });

    const result = await runRightUsbFlow(deps);

    expect(result.editorReady).toBe(false);
    expect(phaseOf(finalState())).toBe("busy_or_already_open");
  });

  it("declares firmware_contract_mismatch when neither contract works", async () => {
    const { deps, finalState } = makeDeps({
      openMonitor: vi.fn(async () => undefined),
      probeStudioRpc: vi.fn(async () => {
        throw new DeviceInfoTimeoutError(5000, "usb");
      }),
    });

    const result = await runRightUsbFlow(deps);

    expect(result.monitor).toBeUndefined();
    expect(result.editorReady).toBe(false);
    expect(phaseOf(finalState())).toBe("firmware_contract_mismatch");
  });

  it("reports missing detection but still tries the interactive pickers", async () => {
    const { deps, events } = makeDeps({
      detect: vi.fn(async () => ({
        hidDevices: [],
        serialPorts: [],
        rawHidVisible: false,
        serialVisible: false,
      })),
    });

    await runRightUsbFlow(deps);

    expect(events[0]).toEqual({ type: "usb_detection_result", visible: false });
    expect(deps.openMonitor).toHaveBeenCalled();
    expect(deps.openSerialTransport).toHaveBeenCalled();
  });

  it("never dispatches studio_rpc_ready on port open success alone", async () => {
    const { deps, events } = makeDeps({
      probeStudioRpc: vi.fn(async () => {
        throw new DeviceInfoTimeoutError(5000, "usb");
      }),
    });

    await runRightUsbFlow(deps);

    // openSerialTransport succeeded but no studio_rpc_ready is dispatched.
    expect(deps.openSerialTransport).toHaveBeenCalled();
    expect(events.some((e) => e.type === "studio_rpc_ready")).toBe(false);
  });
});
