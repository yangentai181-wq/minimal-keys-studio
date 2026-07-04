// Right-hand USB connect orchestration.
//
// Order of operations (the right USB device is the main entry point):
//   1. Detect granted USB devices (WebHID + WebSerial) and log diagnostics.
//   2. Open the Raw HID vendor interface → realtime monitor contract.
//      Monitor works WITHOUT Studio RPC.
//   3. Open Web Serial and probe Studio RPC (core.getDeviceInfo).
//      Only a successful probe establishes the editor contract;
//      port.open() success alone is never treated as connected.

import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

import type { CoordinatorEvent } from "./coordinator";
import type { RawHidSubscription } from "./rawHid";
import type { RightUsbDetection } from "./usbDiagnostics";
import { DeviceInfoTimeoutError } from "../rpc/deviceInfo";
import { SerialPortBusyError } from "../transport/serial";

export type RightUsbFlowDeps = {
  dispatch: (event: CoordinatorEvent) => void;
  detect: () => Promise<RightUsbDetection>;
  logDetection?: (detection: RightUsbDetection) => void;
  /** Open the Raw HID monitor. undefined = user cancelled the picker. */
  openMonitor: () => Promise<RawHidSubscription | undefined>;
  /** Open the Web Serial transport (throws SerialPortBusyError when held). */
  openSerialTransport: () => Promise<RpcTransport>;
  /**
   * Establish the Studio RPC contract on the transport
   * (create_rpc_connection + core.getDeviceInfo). Must throw
   * DeviceInfoTimeoutError on probe timeout and dispose the transport
   * itself on failure.
   */
  probeStudioRpc: (transport: RpcTransport) => Promise<void>;
};

export type RightUsbFlowResult = {
  monitor?: RawHidSubscription;
  editorReady: boolean;
};

export async function runRightUsbFlow(
  deps: RightUsbFlowDeps,
): Promise<RightUsbFlowResult> {
  const { dispatch } = deps;

  // 1. Detection + diagnostics. A missing grant is not fatal: the
  // interactive pickers below can still establish the contracts.
  let detectionVisible = false;
  try {
    const detection = await deps.detect();
    deps.logDetection?.(detection);
    detectionVisible = detection.rawHidVisible || detection.serialVisible;
  } catch (error) {
    console.warn("[right-usb] detection failed:", error);
  }
  dispatch({ type: "usb_detection_result", visible: detectionVisible });

  // 2. Raw HID monitor (primary realtime path).
  let monitor: RawHidSubscription | undefined;
  dispatch({ type: "webhid_opening" });
  try {
    monitor = await deps.openMonitor();
    if (monitor) {
      dispatch({ type: "webhid_ready" });
    } else {
      dispatch({
        type: "webhid_unavailable",
        reason: "Raw HIDデバイスが選択されませんでした。",
      });
    }
  } catch (error) {
    dispatch({
      type: "webhid_unavailable",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  // 3. Studio RPC probe over Web Serial (editor path).
  dispatch({ type: "webserial_opening" });
  let transport: RpcTransport;
  try {
    transport = await deps.openSerialTransport();
  } catch (error) {
    if (error instanceof SerialPortBusyError) {
      dispatch({ type: "serial_busy", reason: error.message });
    } else if (error instanceof UserCancelledError) {
      dispatch({ type: "serial_failed", reason: undefined });
    } else {
      dispatch({
        type: "serial_failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return { monitor, editorReady: false };
  }

  try {
    await deps.probeStudioRpc(transport);
  } catch (error) {
    if (error instanceof DeviceInfoTimeoutError) {
      dispatch({ type: "serial_rpc_timeout" });
    } else {
      dispatch({
        type: "serial_failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return { monitor, editorReady: false };
  }

  dispatch({ type: "studio_rpc_ready", transport: "usb" });
  return { monitor, editorReady: true };
}
