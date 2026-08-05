import { AppHeader } from "./AppHeader";
import { Cable } from "lucide-react";

import { create_rpc_connection } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "./rpc/logging";

import type { Notification } from "@zmkfirmware/zmk-studio-ts-client/studio";
import { ConnectionState, ConnectionContext } from "./rpc/ConnectionContext";
import { Dispatch, useCallback, useEffect, useRef, useState } from "react";
import { ConnectModal, TransportFactory } from "./ConnectModal";

import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { connect as serial_connect } from "./transport/serial";
import { connect as gatt_connect } from "./transport/gatt";
import {
  connect as tauri_ble_connect,
  list_devices as ble_list_devices,
} from "./tauri/ble";
import {
  connect as tauri_serial_connect,
  list_devices as serial_list_devices,
} from "./tauri/serial";
import Keyboard from "./keyboard/Keyboard";
import { TrackballSettings } from "./trackball/TrackballSettings";
import { TrackballPrecisionProvider } from "./trackball/TrackballPrecisionContext";
import { EncoderSettings } from "./encoder/EncoderSettings";
import { BleManagement } from "./bluetooth/BleManagement";
import { BatteryHistory } from "./battery/BatteryHistory";
import { DeviceSettings } from "./settings/DeviceSettings";
import { HoldTapSettings } from "./holdtap/HoldTapSettings";
import { ComboSettings } from "./combos/ComboSettings";
import { BehaviorsProvider } from "./behaviors/BehaviorsContext";
import { CustomSubsystemsProvider } from "./rpc/CustomSubsystemsProvider";
import { UndoRedoContext, useUndoRedo } from "./undoRedo";
import { pub, useSub } from "./usePubSub";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { LockStateContext } from "./rpc/LockStateContext";
import { UnlockModal } from "./UnlockModal";
import { AppFooter } from "./AppFooter";
import { AboutModal } from "./AboutModal";
import { LicenseNoticeModal } from "./misc/LicenseNoticeModal";
import { ToastProvider, useToast } from "./misc/Toast";
import { OsModeProvider } from "./OsModeContext";
import { TelemetryProvider, useTelemetry } from "./telemetry/TelemetryProvider";
import { OptInDialog } from "./telemetry/OptInDialog";
import { disposeTransport } from "./rpc/transportLifecycle";
import { requestDeviceInfo } from "./rpc/deviceInfo";
import { UnifiedStudioPreview } from "./UnifiedStudioPreview";
import { useRightUsbConnection } from "./connection/useRightUsbConnection";
import { MonitorPanel } from "./monitor/MonitorPanel";
import { StudioConnectionOverview } from "./StudioConnectionOverview";
import { DirtyStateProvider, useDirtyRegistration } from "./navigation/DirtyStateContext";
import { StudioTabView } from "./navigation/StudioTabView";
import { useStudioSessionNavigation } from "./navigation/StudioSessionNavigation";
import { handleNotificationEnd } from "./notificationEnd";
import { normalizeConnectionError } from "./copy/connectionErrors";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: object;
  }
}

const TRANSPORTS: TransportFactory[] = [
  // Tauri native transports (pick_and_connect pattern)
  ...(window.__TAURI_INTERNALS__
    ? [
        {
          label: "BLE",
          isWireless: true,
          pick_and_connect: {
            list: ble_list_devices,
            connect: tauri_ble_connect,
          },
        },
        {
          label: "USB",
          pick_and_connect: {
            list: serial_list_devices,
            connect: tauri_serial_connect,
          },
        },
      ]
    : []),
  // Browser Web Serial (only when not in Tauri)
  ...(!window.__TAURI_INTERNALS__ && navigator.serial
    ? [{ label: "USB", connect: serial_connect }]
    : []),
  // Browser Web Bluetooth (only when not in Tauri)
  ...(!window.__TAURI_INTERNALS__ && navigator.bluetooth
    ? [{ label: "BLE", isWireless: true, connect: gatt_connect }]
    : []),
].filter((t) => t !== undefined);

const USB_DEVICE_INFO_TIMEOUT_MS = 5000;
const WIRELESS_DEVICE_INFO_TIMEOUT_MS = 8000;

async function listen_for_notifications(
  notification_stream: ReadableStream<Notification>,
  signal: AbortSignal,
): Promise<void> {
  const reader = notification_stream.getReader();
  const onAbort = () => {
    reader.cancel();
    reader.releaseLock();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  for (;;) {
    try {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      pub("rpc_notification", value);

      const subsystem = Object.entries(value).find(([, v]) => v !== undefined);
      if (!subsystem) {
        continue;
      }

      const [subId, subData] = subsystem;
      const event = Object.entries(subData).find(([, v]) => v !== undefined);

      if (!event) {
        continue;
      }

      const [eventName, eventData] = event;
      const topic = ["rpc_notification", subId, eventName].join(".");

      pub(topic, eventData);
    } catch (e) {
      signal.removeEventListener("abort", onAbort);
      reader.releaseLock();
      throw e;
    }
  }

  signal.removeEventListener("abort", onAbort);
  reader.releaseLock();
  notification_stream.cancel();
}

async function connect(
  transport: RpcTransport,
  setConn: Dispatch<ConnectionState>,
  setConnectedDeviceName: Dispatch<string | undefined>,
  abortController: AbortController,
  onError: (msg: string) => void,
  onUnexpectedDisconnect: () => void | Promise<void>,
  isWireless?: boolean,
) {
  const signal = abortController.signal;
  const conn = await create_rpc_connection(transport, { signal });

  const timeout = isWireless
    ? WIRELESS_DEVICE_INFO_TIMEOUT_MS
    : USB_DEVICE_INFO_TIMEOUT_MS;
  let details;

  try {
    details = await requestDeviceInfo(conn, timeout, call_rpc, {
      transport: isWireless ? "ble" : "usb",
    });
  } catch (error) {
    const message = normalizeConnectionError(error);
    console.error("Failed to initialize Studio connection:", error);
    abortController.abort("Device info request failed");
    await disposeTransport(transport, "Device info request failed");
    if (message) {
      onError(message);
    }
    throw error;
  }

  const onNotificationEnd = () => handleNotificationEnd(signal.aborted, onUnexpectedDisconnect);
  void listen_for_notifications(conn.notification_readable, signal).then(
    onNotificationEnd,
    onNotificationEnd,
  );

  setConnectedDeviceName(details.name);
  setConn({ conn });
}

function AppInner() {
  const { toast } = useToast();
  const { trackEvent } = useTelemetry();
  const session = useStudioSessionNavigation({
    onTabChanged: (tab) => trackEvent("tab_switched", { tab }),
  });
  const [conn, setConn] = useState<ConnectionState>({ conn: null });
  const [connectedDeviceName, setConnectedDeviceName] = useState<
    string | undefined
  >(undefined);
  const [doIt, undo, redo, canUndo, canRedo, reset] = useUndoRedo();
  const [showAbout, setShowAbout] = useState(false);
  const [showLicenseNotice, setShowLicenseNotice] = useState(false);
  const [connectionAbort, setConnectionAbort] = useState(new AbortController());
  const [keymapVersion, setKeymapVersion] = useState(0);

  const [lockState, setLockState] = useState<LockState>(
    LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
  );

  useSub("rpc_notification.core.lockStateChanged", (ls) => {
    setLockState(ls);
  });

  useEffect(() => {
    trackEvent("app_launched");
  }, [trackEvent]);

  const prevConnRef = useRef(conn.conn);
  useEffect(() => {
    if (conn.conn && !prevConnRef.current) {
      trackEvent("device_connected");
    } else if (!conn.conn && prevConnRef.current) {
      trackEvent("device_disconnected");
    }
    prevConnRef.current = conn.conn;
  }, [conn.conn, trackEvent]);

  useEffect(() => {
    if (!conn.conn) {
      reset();
      setLockState(LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED);
    }

    async function updateLockState() {
      if (!conn.conn) {
        return;
      }

      const locked_resp = await call_rpc(conn.conn, {
        core: { getLockState: true },
      });

      setLockState(
        locked_resp.core?.getLockState ||
          LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
      );
    }

    updateLockState();
  }, [conn, setLockState, reset]);

  const save = useCallback(async (): Promise<boolean> => {
      if (!conn.conn) throw new Error("接続されていません");
      const resp = await call_rpc(conn.conn, { keymap: { saveChanges: true } });
      if (!resp.keymap?.saveChanges || resp.keymap?.saveChanges.err) {
        toast("保存できませんでした", "error");
        throw new Error("保存できませんでした");
      } else {
        toast("保存しました", "success");
        trackEvent("keymap_saved");
        pub("keymap_saved_success", true);
        return true;
      }
  }, [conn, toast, trackEvent]);

  const discard = useCallback(async (): Promise<boolean> => {
      if (!conn.conn) throw new Error("接続されていません");
      const resp = await call_rpc(conn.conn, {
        keymap: { discardChanges: true },
      });
      if (!resp.keymap?.discardChanges) {
        toast("破棄できませんでした", "error");
        throw new Error("破棄できませんでした");
      } else {
        toast("破棄しました", "info");
        trackEvent("keymap_discarded");
      }

      reset();
      // Re-mount Keyboard to re-fetch keymap (don't use setConn — it clears ALL data)
      setKeymapVersion((v) => v + 1);
      return true;
  }, [conn, toast, reset, trackEvent]);

  useDirtyRegistration("keymap", { dirty: canUndo, save, discard });

  const resetSettings = useCallback(() => {
    async function doReset() {
      if (!conn.conn) {
        return;
      }

      const resp = await call_rpc(conn.conn, {
        core: { resetSettings: true },
      });
      if (!resp.core?.resetSettings) {
        toast("設定の初期化に失敗しました", "error");
      } else {
        toast("設定を初期化しました", "success");
      }

      reset();
      setKeymapVersion((v) => v + 1);
    }

    doReset();
  }, [conn, toast, reset]);

  const disconnect = useCallback(() => {
    void session.requestExplicitDisconnect(async () => {
      if (!conn.conn) {
        return;
      }

      connectionAbort.abort("User disconnected");
      await conn.conn.request_writable.close().catch((error) => {
        console.warn("Failed to close request stream:", error);
      });
      setConn({ conn: null });
      setConnectedDeviceName(undefined);
      setConnectionAbort(new AbortController());
    });
  }, [conn, connectionAbort, session]);

  const onConnect = useCallback(
    (t: RpcTransport, isWireless?: boolean) => {
      const ac = new AbortController();
      setConnectionAbort(ac);
      return connect(
        t,
        setConn,
        setConnectedDeviceName,
        ac,
        (msg) => toast(msg, "error"),
        () => session.handleUnexpectedDisconnect(() => {
          setConnectedDeviceName(undefined);
          setConn({ conn: null });
        }),
        isWireless,
      );
    },
    [setConn, setConnectedDeviceName, toast, session],
  );

  // Studio RPC probe for the right-USB flow: only a successful
  // core.getDeviceInfo counts as an editor connection.
  const probeStudioRpc = useCallback(
    (t: RpcTransport) => onConnect(t, false),
    [onConnect],
  );

  const rightUsb = useRightUsbConnection({ probeStudioRpc });
  const { notifyBleReady } = rightUsb;

  // Transport list flows (BLE / USB serial only). Report BLE success to the
  // coordinator so its contract display stays truthful.
  const onTransportCreated = useCallback(
    async (t: RpcTransport, isWireless?: boolean) => {
      await onConnect(t, isWireless);
      if (isWireless) {
        notifyBleReady();
      }
    },
    [onConnect, notifyBleReady],
  );

  // Auxiliary BLE editor path launched from the monitor surface.
  const connectBleFromMonitor = useCallback(async () => {
    const ble = TRANSPORTS.find((t) => t.isWireless && t.connect !== undefined);
    if (!ble?.connect) {
      toast("このブラウザではBLE接続を利用できません", "error");
      return;
    }
    try {
      const transport = await ble.connect();
      await onTransportCreated(transport, true);
    } catch (e) {
      console.error(e);
    }
  }, [onTransportCreated, toast]);

  const hasRightUsbFlow = !!window.__TAURI_INTERNALS__ || !!navigator.serial;
  const showMonitorOnly = !conn.conn && rightUsb.monitorActive;

  return (
    <ConnectionContext.Provider value={conn}>
      <LockStateContext.Provider value={lockState}>
        <UndoRedoContext.Provider value={doIt}>
          <BehaviorsProvider>
            <CustomSubsystemsProvider>
              <TrackballPrecisionProvider>
                <UnlockModal />
              <ConnectModal
                open={!conn.conn && !showMonitorOnly}
                transports={TRANSPORTS}
                onTransportCreated={onTransportCreated}
                onConnectRightUsb={
                  hasRightUsbFlow ? rightUsb.connectRightUsb : undefined
                }
                connectionNotice={
                  rightUsb.state.phase !== "idle"
                    ? {
                        title: rightUsb.description.title,
                        body: rightUsb.description.body,
                      }
                    : undefined
                }
              />
              {showMonitorOnly && (
                <div className="bg-base-100 text-base-content h-dvh w-full overflow-hidden">
                  <MonitorPanel
                    snapshot={rightUsb.monitor}
                    description={rightUsb.description}
                    editorAvailable={false}
                    busy={rightUsb.connecting}
                    onRetryEditor={rightUsb.retryEditor}
                    onConnectBle={connectBleFromMonitor}
                    onClose={rightUsb.closeMonitor}
                  />
                </div>
              )}
              <AboutModal
                open={showAbout}
                onClose={() => setShowAbout(false)}
              />
              <LicenseNoticeModal
                open={showLicenseNotice}
                onClose={() => setShowLicenseNotice(false)}
              />
                {conn.conn && (
                <div className="bg-base-100 text-base-content h-dvh w-full min-h-[600px] inline-grid grid-cols-[auto] grid-rows-[auto_auto_auto_minmax(250px,1fr)_auto] overflow-hidden">
                  <AppHeader
                    connectedDeviceLabel={connectedDeviceName}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    onSave={() => { void save().catch(() => {}); }}
                    onDiscard={() => { void discard().catch(() => {}); }}
                    onDisconnect={disconnect}
                    onResetSettings={resetSettings}
                  />
                  <StudioConnectionOverview
                    monitor={rightUsb.monitor}
                    monitorActive={rightUsb.monitorActive}
                    editorAvailable={!!conn.conn}
                    connectionTitle={rightUsb.description.title}
                    connectionBody={rightUsb.description.body}
                    deviceName={connectedDeviceName}
                    showLayout={rightUsb.monitorActive}
                    actions={
                      !rightUsb.monitorActive && hasRightUsbFlow ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-content hover:bg-primary/90 disabled:opacity-50"
                          onClick={rightUsb.connectRightUsb}
                          disabled={rightUsb.connecting}
                        >
                          <Cable className="h-4 w-4" aria-hidden="true" />
                          右手USBモニターを接続
                        </button>
                      ) : undefined
                    }
                  />
                  <StudioTabView
                    activeTab={session.activeTab}
                    onSelectTab={(tab) => { void session.requestTab(tab); }}
                    renderTab={(tab) => {
                      switch (tab) {
                        case "keymap": return <Keyboard key={keymapVersion} />;
                        case "trackball": return <TrackballSettings />;
                        case "encoder": return <EncoderSettings />;
                        case "combo": return <ComboSettings />;
                        case "bluetooth": return <BleManagement />;
                        case "battery": return <BatteryHistory />;
                        case "holdtap": return <HoldTapSettings />;
                        case "settings": return <DeviceSettings />;
                      }
                    }}
                  />
                  <AppFooter
                    onShowAbout={() => setShowAbout(true)}
                    onShowLicenseNotice={() => setShowLicenseNotice(true)}
                  />
                </div>
                )}
              </TrackballPrecisionProvider>
            </CustomSubsystemsProvider>
          </BehaviorsProvider>
        </UndoRedoContext.Provider>
      </LockStateContext.Provider>
    </ConnectionContext.Provider>
  );
}

function App() {
  const isIntegratedPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "integrated";

  if (isIntegratedPreview) {
    return <UnifiedStudioPreview />;
  }

  return (
    <ToastProvider>
      <OsModeProvider>
        <TelemetryProvider>
          <OptInDialog />
          <DirtyStateProvider>
            <AppInner />
          </DirtyStateProvider>
        </TelemetryProvider>
      </OsModeProvider>
    </ToastProvider>
  );
}

export default App;
