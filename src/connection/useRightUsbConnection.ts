// React hook that owns the connection coordinator + Raw HID monitor
// lifecycle for the right-hand USB device.

import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

import {
  describeConnection,
  initialCoordinatorState,
  reduceConnection,
  type ConnectionDescription,
  type CoordinatorEvent,
  type CoordinatorState,
} from "./coordinator";
import { connectRawHidMonitor, type RawHidSubscription } from "./rawHid";
import { runRightUsbFlow } from "./rightUsbFlow";
import { detectRightUsbDevice, logRightUsbDetection } from "./usbDiagnostics";
import { connect as serialConnect } from "../transport/serial";
import { connectTauriRawHidMonitor } from "../tauri/rawHid";
import {
  connect as tauriSerialConnect,
  list_devices as listTauriSerialDevices,
} from "../tauri/serial";
import {
  createMonitorStore,
  type MonitorStore,
} from "../monitor/monitorStore";

export type RightUsbConnection = {
  state: CoordinatorState;
  description: ConnectionDescription;
  /** A stable source of Raw HID frames. Only monitor UI leaves subscribe. */
  monitorStore: MonitorStore;
  monitorActive: boolean;
  connecting: boolean;
  /** Full right-USB flow: Raw HID monitor + Studio RPC probe. */
  connectRightUsb: () => Promise<void>;
  /** Re-run only the Studio RPC (editor) probe, keeping the monitor. */
  retryEditor: () => Promise<void>;
  /** Close the Raw HID monitor and go back to idle. */
  closeMonitor: () => Promise<void>;
  /** Mark the Studio RPC contract as established via BLE. */
  notifyBleReady: (deviceName?: string) => void;
  dispatch: (event: CoordinatorEvent) => void;
};

type RightUsbPlatformOperations = {
  connectMonitor: (
    onFrame: Parameters<typeof connectRawHidMonitor>[0],
    onError?: (reason: string) => void,
  ) => Promise<RawHidSubscription | undefined>;
  detect: typeof detectRightUsbDevice;
  logDetection: typeof logRightUsbDetection;
  openSerialTransport: typeof serialConnect;
};

export async function connectTauriSerialDevice(): Promise<RpcTransport> {
  const devices = await listTauriSerialDevices();
  if (devices.length > 1) {
    throw new Error("複数のUSBシリアルデバイスが見つかりました。詳細な接続方法から対象を選択してください。");
  }
  const device = devices[0];
  if (!device) {
    throw new Error("Studio RPC用のUSBシリアルデバイスが見つかりません。");
  }
  return tauriSerialConnect(device);
}

function defaultPlatformOperations(): RightUsbPlatformOperations {
  const isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
  return {
    connectMonitor: isTauri
      ? connectTauriRawHidMonitor
      : (onFrame) => connectRawHidMonitor(onFrame),
    detect: detectRightUsbDevice,
    logDetection: logRightUsbDetection,
    openSerialTransport: isTauri ? connectTauriSerialDevice : serialConnect,
  };
}

export function useRightUsbConnection(options: {
  /**
   * Establish Studio RPC on the transport (create_rpc_connection +
   * core.getDeviceInfo + app state wiring). Must throw
   * DeviceInfoTimeoutError on probe timeout.
   */
  probeStudioRpc: (transport: RpcTransport) => Promise<void>;
  platform?: Partial<RightUsbPlatformOperations>;
}): RightUsbConnection {
  const { probeStudioRpc } = options;
  const platform = useMemo(
    () => ({ ...defaultPlatformOperations(), ...options.platform }),
    [options.platform],
  );
  const [state, dispatch] = useReducer(
    reduceConnection,
    initialCoordinatorState,
  );
  const [connecting, setConnecting] = useState(false);
  const storeRef = useRef(createMonitorStore());
  const subscriptionRef = useRef<RawHidSubscription | null>(null);
  // Bumped by closeMonitor. An in-flight openMonitor compares its captured
  // generation on resolve; on mismatch the monitor was closed mid-open and
  // the late subscription must be discarded instead of leaking an opened
  // HIDDevice behind a closed UI.
  const monitorGenerationRef = useRef(0);

  const openMonitor = useCallback(async () => {
    if (subscriptionRef.current) {
      return subscriptionRef.current;
    }
    const generation = monitorGenerationRef.current;
    const subscription = await platform.connectMonitor(
      (frame) => storeRef.current.push(frame),
      (reason) => {
        subscriptionRef.current = null;
        storeRef.current.reset();
        dispatch({ type: "webhid_unavailable", reason });
      },
    );
    if (!subscription) {
      return undefined;
    }
    if (monitorGenerationRef.current !== generation) {
      // closeMonitor ran while the picker/open was pending: close the
      // late subscription right away instead of resurrecting it.
      await subscription.close();
      return undefined;
    }
    subscriptionRef.current = subscription;
    return subscription;
  }, [platform]);

  const connectRightUsb = useCallback(async () => {
    if (connecting) {
      return;
    }
    setConnecting(true);
    try {
      await runRightUsbFlow({
        dispatch,
        detect: platform.detect,
        logDetection: platform.logDetection,
        openMonitor,
        openSerialTransport: platform.openSerialTransport,
        probeStudioRpc,
      });
    } finally {
      setConnecting(false);
    }
  }, [connecting, openMonitor, platform, probeStudioRpc]);

  const retryEditor = useCallback(async () => {
    if (connecting) {
      return;
    }
    setConnecting(true);
    try {
      dispatch({ type: "webserial_opening" });
      let transport: RpcTransport;
      try {
        transport = await platform.openSerialTransport();
      } catch (error) {
        dispatch({
          type: "serial_failed",
          reason: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      try {
        await probeStudioRpc(transport);
        dispatch({ type: "studio_rpc_ready", transport: "usb" });
      } catch {
        dispatch({ type: "serial_rpc_timeout" });
      }
    } finally {
      setConnecting(false);
    }
  }, [connecting, platform, probeStudioRpc]);

  const closeMonitor = useCallback(async () => {
    monitorGenerationRef.current += 1;
    const subscription = subscriptionRef.current;
    subscriptionRef.current = null;
    if (subscription) {
      await subscription.close();
    }
    storeRef.current.reset();
    dispatch({ type: "monitor_closed" });
  }, []);

  const notifyBleReady = useCallback((deviceName?: string) => {
    dispatch({ type: "studio_rpc_ready", transport: "ble", deviceName });
  }, []);

  const description = useMemo(() => describeConnection(state), [state]);

  return {
    state,
    description,
    monitorStore: storeRef.current,
    monitorActive: state.contracts.rawHidMonitor,
    connecting,
    connectRightUsb,
    retryEditor,
    closeMonitor,
    notifyBleReady,
    dispatch,
  };
}
