import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { create_rpc_connection } from "@zmkfirmware/zmk-studio-ts-client";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import type { Notification } from "@zmkfirmware/zmk-studio-ts-client/studio";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

import { AboutModal } from "./AboutModal";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { BatteryHistory } from "./battery/BatteryHistory";
import { BehaviorsProvider } from "./behaviors/BehaviorsContext";
import { BleManagement } from "./bluetooth/BleManagement";
import { ComboSettings } from "./combos/ComboSettings";
import { ConnectModal, TransportFactory } from "./ConnectModal";
import { RightUsbEditorShell } from "./connection/RightUsbEditorShell";
import { useRightUsbConnection } from "./connection/useRightUsbConnection";
import { EncoderSettings } from "./encoder/EncoderSettings";
import { HoldTapSettings } from "./holdtap/HoldTapSettings";
import Keyboard from "./keyboard/Keyboard";
import { KeyboardWorkspace } from "./keyboard/KeyboardWorkspace";
import { MonitorKeymapProvider } from "./keyboard/MonitorKeymapContext";
import { LicenseNoticeModal } from "./misc/LicenseNoticeModal";
import { ToastProvider, useToast } from "./misc/Toast";
import { MonitorPanel } from "./monitor/MonitorPanel";
import { useUnsavedChanges } from "./rpc/useUnsavedChanges";
import {
  DirtyStateProvider,
  useDirtyRegistration,
} from "./navigation/DirtyStateContext";
import { useStudioSessionNavigation } from "./navigation/StudioSessionNavigation";
import { StudioTabView } from "./navigation/StudioTabView";
import { handleNotificationEnd } from "./notificationEnd";
import { OsModeProvider } from "./OsModeContext";
import { ConnectionContext, ConnectionState } from "./rpc/ConnectionContext";
import { CustomSubsystemsProvider } from "./rpc/CustomSubsystemsProvider";
import { requestDeviceInfo } from "./rpc/deviceInfo";
import { LockStateContext } from "./rpc/LockStateContext";
import { call_rpc } from "./rpc/logging";
import type { EventName } from "./telemetry/events";
import { publishKeymapChanged } from "./keyboard/keymap-events";
import * as rpcLogging from "./rpc/logging";
import { disposeTransport } from "./rpc/transportLifecycle";
import { DeviceSettings } from "./settings/DeviceSettings";
import { OptInDialog } from "./telemetry/OptInDialog";
import { TelemetryProvider, useTelemetry } from "./telemetry/TelemetryProvider";
import {
  connect as tauri_ble_connect,
  list_devices as ble_list_devices,
} from "./tauri/ble";
import {
  connect as tauri_serial_connect,
  list_devices as serial_list_devices,
} from "./tauri/serial";
import { TrackballPrecisionProvider } from "./trackball/TrackballPrecisionContext";
import { TrackballSettings } from "./trackball/TrackballSettings";
import { connect as gatt_connect } from "./transport/gatt";
import { connect as serial_connect } from "./transport/serial";
import { TourPromptDialog } from "./tour/TourPromptDialog";
import { useTour } from "./tour/useTour";
import { UndoRedoContext, useUndoRedo } from "./undoRedo";
import { UnifiedStudioPreview } from "./UnifiedStudioPreview";
import { checkForUpdate, type ReleaseInfo } from "./update/versionCheck";
import { UnlockModal } from "./UnlockModal";
import { pub, useSub } from "./usePubSub";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: object;
  }
}

const TRANSPORTS: TransportFactory[] = [
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
  ...(!window.__TAURI_INTERNALS__ && navigator.serial
    ? [{ label: "USB", connect: serial_connect }]
    : []),
  ...(!window.__TAURI_INTERNALS__ && navigator.bluetooth
    ? [{ label: "BLE", isWireless: true, connect: gatt_connect }]
    : []),
].filter((transport) => transport !== undefined);

const USB_DEVICE_INFO_TIMEOUT_MS = 5000;
const WIRELESS_DEVICE_INFO_TIMEOUT_MS = 8000;

async function callRpcWithFeedback(
  conn: Parameters<typeof call_rpc>[0],
  request: Parameters<typeof call_rpc>[1],
  onFailure: () => void,
) {
  if ("callRpcOrNotify" in rpcLogging) {
    return rpcLogging.callRpcOrNotify(conn, request, onFailure);
  }
  try {
    return await call_rpc(conn, request);
  } catch {
    onFailure();
    return undefined;
  }
}

async function listen_for_notifications(
  notificationStream: ReadableStream<Notification>,
  signal: AbortSignal,
): Promise<void> {
  const reader = notificationStream.getReader();
  const onAbort = () => {
    void reader.cancel();
    reader.releaseLock();
  };
  signal.addEventListener("abort", onAbort, { once: true });

  for (;;) {
    try {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      pub("rpc_notification", value);
      const subsystem = Object.entries(value).find(([, data]) => data !== undefined);
      if (!subsystem) continue;

      const [subsystemId, subsystemData] = subsystem;
      const event = Object.entries(subsystemData).find(
        ([, eventData]) => eventData !== undefined,
      );
      if (!event) continue;

      const [eventName, eventData] = event;
      pub(["rpc_notification", subsystemId, eventName].join("."), eventData);
    } catch (error) {
      signal.removeEventListener("abort", onAbort);
      reader.releaseLock();
      throw error;
    }
  }

  signal.removeEventListener("abort", onAbort);
  reader.releaseLock();
  await notificationStream.cancel();
}

async function connect(
  transport: RpcTransport,
  setConn: Dispatch<ConnectionState>,
  setConnectedDeviceName: Dispatch<string | undefined>,
  abortController: AbortController,
  onUnexpectedDisconnect: () => void | Promise<void>,
  isWireless?: boolean,
): Promise<void> {
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
    console.error("Failed to initialize Studio connection:", error);
    abortController.abort("Device info request failed");
    await disposeTransport(transport, "Device info request failed");
    throw error;
  }

  const onNotificationEnd = () =>
    handleNotificationEnd(signal.aborted, onUnexpectedDisconnect);
  void listen_for_notifications(conn.notification_readable, signal).then(
    onNotificationEnd,
    onNotificationEnd,
  );

  setConnectedDeviceName(details.name);
  setConn({ conn });
}

// eslint-disable-next-line react-refresh/only-export-components
export async function discardKeymapChanges(
  conn: NonNullable<ConnectionState["conn"]>,
  reset: () => void,
  setKeymapVersion: Dispatch<SetStateAction<number>>,
  toast: (message: string, kind: "error" | "info") => void,
  trackEvent: (event: EventName) => void,
): Promise<boolean> {
  const resp = await callRpcWithFeedback(
    conn,
    { keymap: { discardChanges: true } },
    () => toast("破棄できませんでした", "error"),
  );
  if (!resp?.keymap?.discardChanges) {
    toast("破棄できませんでした", "error");
    throw new Error("破棄できませんでした");
  }

  toast("破棄しました", "info");
  trackEvent("keymap_discarded");
  reset();
  setKeymapVersion((version: number) => version + 1);
  publishKeymapChanged();
  return true;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function saveKeymapChanges(
  conn: NonNullable<ConnectionState["conn"]>,
  reset: () => void,
  toast: ReturnType<typeof useToast>["toast"],
  trackEvent: (event: EventName) => void,
): Promise<boolean> {
  const resp = await callRpcWithFeedback(
    conn,
    { keymap: { saveChanges: true } },
    () => toast("保存できませんでした", "error"),
  );
  if (!resp?.keymap?.saveChanges || resp.keymap.saveChanges.err) {
    toast("保存できませんでした", "error");
    throw new Error("保存できませんでした");
  }

  reset();
  toast("保存しました", "success");
  trackEvent("keymap_saved");
  void pub("keymap_saved_success", true);
  return true;
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
  const [fwUpdateOpen, setFwUpdateOpen] = useState(false);
  const [connectionAbort, setConnectionAbort] = useState(new AbortController());
  const [keymapVersion, setKeymapVersion] = useState(0);
  const { unsaved: deviceUnsaved } = useUnsavedChanges();
  const [availableUpdate, setAvailableUpdate] = useState<ReleaseInfo | null>(null);
  const [isWireless, setIsWireless] = useState<boolean | undefined>(undefined);
  const [lockState, setLockState] = useState<LockState>(
    LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
  );

  useSub("rpc_notification.core.lockStateChanged", (nextLockState) => {
    setLockState(nextLockState);
  });

  const { startTour, promptOpen, acceptPrompt, declinePrompt } = useTour({
    connected: !!conn.conn,
    unlocked: lockState === LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED,
    activeTab: session.activeTab,
    setActiveTab: () => {
      void session.requestTab("keymap");
    },
  });

  useEffect(() => {
    trackEvent("app_launched");
  }, [trackEvent]);

  useEffect(() => {
    const check = () =>
      checkForUpdate().then((result) => {
        setAvailableUpdate(
          result.status === "available" ? result.release : null,
        );
      });
    void check();
    const interval = window.setInterval(check, 24 * 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const previousConnection = useRef(conn.conn);
  useEffect(() => {
    if (conn.conn && !previousConnection.current) {
      trackEvent("device_connected");
    } else if (!conn.conn && previousConnection.current) {
      trackEvent("device_disconnected");
    }
    previousConnection.current = conn.conn;
  }, [conn.conn, trackEvent]);

  useEffect(() => {
    if (!conn.conn) {
      reset();
      setLockState(LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED);
      return;
    }

    const activeConn = conn.conn;
    async function updateLockState() {
      const response = await callRpcWithFeedback(
        activeConn,
        { core: { getLockState: true } },
        () => toast("接続状態を確認できませんでした", "error"),
      );
      if (!response) return;

      setLockState(
        response.core?.getLockState ||
          LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
      );
    }

    void updateLockState();
  }, [conn.conn, reset, toast]);

  const save = useCallback(async (): Promise<boolean> => {
      if (!conn.conn) throw new Error("接続されていません");
      return saveKeymapChanges(conn.conn, reset, toast, trackEvent);
  }, [conn, reset, toast, trackEvent]);

  const discard = useCallback(async (): Promise<boolean> => {
      if (!conn.conn) throw new Error("接続されていません");
      return discardKeymapChanges(conn.conn, reset, setKeymapVersion, toast, trackEvent);
  }, [conn, toast, reset, trackEvent]);

  // The keyboard keeps edits in RAM until they are saved to flash, and that
  // state outlives the page: a reload empties the undo history while the
  // keyboard is still holding unsaved changes that a power cycle would drop.
  useDirtyRegistration("keymap", {
    dirty: canUndo || deviceUnsaved,
    save,
    discard,
  });

  // Tell the user about unsaved changes they did not make in this session.
  const announcedUnsavedRef = useRef(false);
  useEffect(() => {
    if (!conn.conn) {
      announcedUnsavedRef.current = false;
      return;
    }
    if (deviceUnsaved && !canUndo && !announcedUnsavedRef.current) {
      announcedUnsavedRef.current = true;
      toast(
        "キーボードに未保存の変更が残っています。保存を押すと確定します",
        "info",
      );
    }
  }, [conn.conn, deviceUnsaved, canUndo, toast]);

  const resetSettings = useCallback(() => {
    async function doReset() {
      if (!conn.conn) return;
      const response = await callRpcWithFeedback(
        conn.conn,
        { core: { resetSettings: true } },
        () => toast("設定の初期化に失敗しました", "error"),
      );
      if (!response) return;
      if (!response.core?.resetSettings) {
        toast("設定の初期化に失敗しました", "error");
        return;
      }

      toast("設定を初期化しました", "success");
      reset();
      setKeymapVersion((version) => version + 1);
    }

    void doReset();
  }, [conn.conn, reset, toast]);

  const closeActiveConnection = useCallback(async () => {
    if (!conn.conn) return;

    connectionAbort.abort("Connection closed");
    await conn.conn.request_writable.close().catch((error) => {
      console.warn("Failed to close request stream:", error);
    });
    setConn({ conn: null });
    setConnectedDeviceName(undefined);
    setIsWireless(undefined);
    setConnectionAbort(new AbortController());
  }, [conn.conn, connectionAbort]);

  const disconnect = useCallback(() => {
    void session.requestExplicitDisconnect(closeActiveConnection);
  }, [closeActiveConnection, session]);

  const onConnect = useCallback(
    async (transport: RpcTransport, wireless?: boolean): Promise<boolean> => {
      setIsWireless(wireless);
      const abortController = new AbortController();
      setConnectionAbort(abortController);
      await connect(
        transport,
        setConn,
        setConnectedDeviceName,
        abortController,
        () =>
          session.handleUnexpectedDisconnect(() => {
            setConnectedDeviceName(undefined);
            setConn({ conn: null });
            setIsWireless(undefined);
          }),
        wireless,
      );
      toast("キーボードに接続しました", "success");
      return true;
    },
    [session, toast],
  );

  useEffect(() => {
    if (!conn.conn) return;
    const activeConn = conn.conn;

    if (!("registerForceDisconnect" in rpcLogging)) return;
    rpcLogging.registerForceDisconnect(activeConn, () => {
      toast("デバイスの応答がありません。接続を解除しました", "error");
      connectionAbort.abort("rpc-timeout");
      void session.handleUnexpectedDisconnect(() => {
        setConnectedDeviceName(undefined);
        setConn({ conn: null });
        setIsWireless(undefined);
      });
    });

    return () => rpcLogging.registerForceDisconnect(activeConn, null);
  }, [conn.conn, connectionAbort, session, toast]);

  const probeStudioRpc = useCallback(
    async (transport: RpcTransport) => {
      await onConnect(transport, false);
    },
    [onConnect],
  );
  const rightUsb = useRightUsbConnection({ probeStudioRpc });
  const { notifyBleReady } = rightUsb;

  const handleFwUpdateOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setFwUpdateOpen(false);
        return;
      }
      void session.requestExplicitDisconnect(async () => {
        await rightUsb.closeMonitor();
        await closeActiveConnection();
        setFwUpdateOpen(true);
      });
    },
    [closeActiveConnection, rightUsb, session],
  );

  const onTransportCreated = useCallback(
    async (transport: RpcTransport, wireless?: boolean): Promise<boolean> => {
      const connected = await onConnect(transport, wireless);
      if (wireless) notifyBleReady();
      return connected;
    },
    [notifyBleReady, onConnect],
  );

  const connectBleFromMonitor = useCallback(async () => {
    const ble = TRANSPORTS.find(
      (transport) => transport.isWireless && transport.connect !== undefined,
    );
    if (!ble?.connect) {
      toast("このブラウザではBLE接続を利用できません", "error");
      return;
    }
    try {
      const transport = await ble.connect();
      await onTransportCreated(transport, true);
    } catch (error) {
      console.error(error);
    }
  }, [onTransportCreated, toast]);

  const hasRightUsbFlow = !!window.__TAURI_INTERNALS__ || !!navigator.serial;
  const showMonitorOnly = !conn.conn && rightUsb.monitorActive;
  const header = (
    <AppHeader
      connectedDeviceLabel={connectedDeviceName}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      onSave={save}
      onDiscard={() => {
        void discard().catch(() => undefined);
      }}
      onDisconnect={disconnect}
      onResetSettings={resetSettings}
      onStartTour={startTour}
      isWireless={isWireless}
      availableUpdate={availableUpdate}
      fwUpdateOpen={fwUpdateOpen}
      onFwUpdateOpenChange={handleFwUpdateOpenChange}
    />
  );

  return (
    <ConnectionContext.Provider value={conn}>
      <LockStateContext.Provider value={lockState}>
        <UndoRedoContext.Provider value={doIt}>
          <BehaviorsProvider>
            <CustomSubsystemsProvider>
              <TrackballPrecisionProvider>
                <UnlockModal />
                <TourPromptDialog
                  open={promptOpen}
                  onAccept={acceptPrompt}
                  onDecline={declinePrompt}
                />
                <ConnectModal
                  open={!conn.conn && !showMonitorOnly && !fwUpdateOpen}
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

                {showMonitorOnly && !fwUpdateOpen && (
                  <div className="h-screen w-full overflow-hidden bg-base-100 text-base-content">
                    <MonitorPanel
                      monitorStore={rightUsb.monitorStore}
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

                {!conn.conn && fwUpdateOpen && (
                  <div className="flex h-screen w-full flex-col overflow-hidden bg-base-100 text-base-content">
                    {header}
                  </div>
                )}

                {conn.conn && (
                  <MonitorKeymapProvider>
                    <RightUsbEditorShell
                      header={header}
                      monitorStore={rightUsb.monitorStore}
                      monitorActive={rightUsb.monitorActive}
                      editorAvailable
                      connectionTitle={rightUsb.description.title}
                      connectionBody={rightUsb.description.body}
                      deviceName={connectedDeviceName}
                      editor={
                        <StudioTabView
                          activeTab={session.activeTab}
                          onSelectTab={(tab) => {
                            void session.requestTab(tab);
                          }}
                          renderTab={(tab) => {
                            switch (tab) {
                              case "keymap":
                                return (
                                  <KeyboardWorkspace
                                    editor={<Keyboard key={keymapVersion} />}
                                    monitorStore={rightUsb.monitorStore}
                                    monitorActive={rightUsb.monitorActive}
                                    monitorBusy={rightUsb.connecting}
                                    onConnectMonitor={
                                      hasRightUsbFlow
                                        ? rightUsb.connectRightUsb
                                        : undefined
                                    }
                                  />
                                );
                              case "trackball":
                                return <TrackballSettings />;
                              case "encoder":
                                return <EncoderSettings />;
                              case "combo":
                                return <ComboSettings />;
                              case "bluetooth":
                                return <BleManagement />;
                              case "battery":
                                return <BatteryHistory />;
                              case "holdtap":
                                return <HoldTapSettings />;
                              case "settings":
                                return <DeviceSettings />;
                            }
                          }}
                        />
                      }
                      footer={
                        <AppFooter
                          onShowAbout={() => setShowAbout(true)}
                          onShowLicenseNotice={() =>
                            setShowLicenseNotice(true)
                          }
                        />
                      }
                    />
                  </MonitorKeymapProvider>
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

  if (isIntegratedPreview) return <UnifiedStudioPreview />;

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
