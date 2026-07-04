// Connection coordinator: an explicit state machine for the right-hand
// USB-first connection architecture.
//
// Design principle: never treat "the USB port opened" as "connected".
// Each contract is tracked separately:
//   - rawHidMonitor : WebHID vendor interface (0xff60/0x61) opened → monitor OK
//   - studioRpc     : core.getDeviceInfo answered → editor OK
//
// Root cause background (verified on-device 2026-07-04): ZMK Studio RPC
// listens ONLY on the transport of the currently selected output endpoint
// (zmk rpc.c refresh_selected_transport). When the keyboard's output is
// BLE, the USB CDC port opens fine but silently ignores RPC frames. The
// serial_open_but_rpc_unavailable state exists for exactly that case.

export type ConnectionPhase =
  | "idle"
  | "right_usb_not_detected"
  | "right_usb_detected"
  | "opening_webhid"
  | "rawhid_monitor_ready"
  | "opening_webserial"
  | "serial_open_but_rpc_unavailable"
  | "studio_rpc_ready"
  | "ble_optional_ready"
  | "firmware_contract_mismatch"
  | "busy_or_already_open";

export type ConnectionContracts = {
  /** Raw HID frames can be read → realtime monitor is usable. */
  rawHidMonitor: boolean;
  /** core.getDeviceInfo answered → editor is usable. */
  studioRpc: boolean;
  /** Transport that satisfied the Studio RPC contract, if any. */
  studioTransport: "usb" | "ble" | null;
};

export type CoordinatorState = {
  phase: ConnectionPhase;
  contracts: ConnectionContracts;
  deviceName?: string;
  detail?: string;
};

export type CoordinatorEvent =
  | { type: "reset" }
  | { type: "usb_detection_result"; visible: boolean }
  | { type: "webhid_opening" }
  | { type: "webhid_ready" }
  | { type: "webhid_unavailable"; reason?: string }
  | { type: "webserial_opening" }
  | { type: "serial_busy"; reason?: string }
  | { type: "serial_rpc_timeout" }
  | { type: "serial_failed"; reason?: string }
  | { type: "studio_rpc_ready"; transport: "usb" | "ble"; deviceName?: string }
  | { type: "monitor_closed" };

export const initialCoordinatorState: CoordinatorState = {
  phase: "idle",
  contracts: { rawHidMonitor: false, studioRpc: false, studioTransport: null },
};

export function reduceConnection(
  state: CoordinatorState,
  event: CoordinatorEvent,
): CoordinatorState {
  const { contracts } = state;

  switch (event.type) {
    case "reset":
      return initialCoordinatorState;

    case "usb_detection_result":
      return {
        ...state,
        phase: event.visible ? "right_usb_detected" : "right_usb_not_detected",
      };

    case "webhid_opening":
      return { ...state, phase: "opening_webhid" };

    case "webhid_ready":
      return {
        ...state,
        phase: "rawhid_monitor_ready",
        contracts: { ...contracts, rawHidMonitor: true },
      };

    case "webhid_unavailable":
      return {
        ...state,
        contracts: { ...contracts, rawHidMonitor: false },
        detail: event.reason,
      };

    case "webserial_opening":
      return { ...state, phase: "opening_webserial" };

    case "serial_busy":
      return {
        ...state,
        // Monitor may still be running; the busy state only refers to the
        // serial/editor contract.
        phase: "busy_or_already_open",
        detail: event.reason,
      };

    case "serial_rpc_timeout":
      return {
        ...state,
        phase: contracts.rawHidMonitor
          ? "serial_open_but_rpc_unavailable"
          : "firmware_contract_mismatch",
        contracts: { ...contracts, studioRpc: false, studioTransport: null },
      };

    case "serial_failed":
      return {
        ...state,
        phase: contracts.rawHidMonitor
          ? "rawhid_monitor_ready"
          : "right_usb_detected",
        detail: event.reason,
      };

    case "studio_rpc_ready":
      return {
        ...state,
        phase:
          event.transport === "ble" && !contracts.rawHidMonitor
            ? "ble_optional_ready"
            : "studio_rpc_ready",
        deviceName: event.deviceName ?? state.deviceName,
        contracts: {
          ...contracts,
          studioRpc: true,
          studioTransport: event.transport,
        },
      };

    case "monitor_closed":
      return {
        ...state,
        phase: contracts.studioRpc ? state.phase : "idle",
        contracts: { ...contracts, rawHidMonitor: false },
      };

    default:
      return state;
  }
}

export type ConnectionDescription = {
  title: string;
  body: string;
  monitorAvailable: boolean;
  editorAvailable: boolean;
};

/**
 * User-facing copy per state. The wording reports WHICH CONTRACT was
 * established (or not), never just "the port opened".
 */
export function describeConnection(
  state: CoordinatorState,
): ConnectionDescription {
  const monitorAvailable = state.contracts.rawHidMonitor;
  const editorAvailable = state.contracts.studioRpc;

  switch (state.phase) {
    case "idle":
      return {
        title: "未接続",
        body: "右手側（USBケーブルを挿す側）をUSBで接続してください。",
        monitorAvailable,
        editorAvailable,
      };
    case "right_usb_not_detected":
      return {
        title: "右手USBデバイスが見つかりません",
        body: "右手USBデバイスがOSから見えていません。ケーブルが右手側（central）に挿さっているか、データ通信対応ケーブルかを確認してください。初回はデバイス選択ダイアログでの許可も必要です。",
        monitorAvailable,
        editorAvailable,
      };
    case "right_usb_detected":
      return {
        title: "右手USBデバイスを検出",
        body: "USBデバイスは見えています。モニター（Raw HID）とエディター（Studio RPC）の接続を確立します。",
        monitorAvailable,
        editorAvailable,
      };
    case "opening_webhid":
      return {
        title: "モニター接続中",
        body: "Raw HID（リアルタイムモニター用）を開いています…",
        monitorAvailable,
        editorAvailable,
      };
    case "rawhid_monitor_ready":
      return {
        title: "モニター利用可（Raw HID成立）",
        body: "Raw HIDは読めるため、リアルタイムモニターを利用できます。編集にはStudio RPC接続が必要です。",
        monitorAvailable: true,
        editorAvailable,
      };
    case "opening_webserial":
      return {
        title: "エディター接続中",
        body: "USBシリアルを開き、Studio RPC（core.getDeviceInfo）の応答を確認しています…",
        monitorAvailable,
        editorAvailable,
      };
    case "serial_open_but_rpc_unavailable":
      return {
        title: "モニターのみ利用可（Studio RPC応答なし）",
        body:
          "USBシリアルは開けましたが、Studio RPCが応答しません。キーボードの出力先がBLEになっている可能性が高いです（Studio RPCは選択中の出力先でしか待ち受けません）。" +
          "iPadなどとのBLE接続を切るか、キーボードの出力切替キー（&out OUT_USB）でUSB出力に切り替えてから再試行してください。BLEで編集することもできます。",
        monitorAvailable: true,
        editorAvailable: false,
      };
    case "studio_rpc_ready":
      return {
        title: "エディター利用可（Studio RPC成立）",
        body: "デバイス情報の取得に成功しました。キーマップなどの編集ができます。",
        monitorAvailable,
        editorAvailable: true,
      };
    case "ble_optional_ready":
      return {
        title: "BLEで編集接続中（補助経路）",
        body: "BLE経由でStudio RPCが成立しています。リアルタイムモニターを使う場合は右手USBも接続してください。",
        monitorAvailable,
        editorAvailable: true,
      };
    case "firmware_contract_mismatch":
      return {
        title: "ファームウェアが応答しません",
        body:
          "Raw HIDもStudio RPCも成立しませんでした。右手側に minimal-keys_R（raw_hid_adapter + studio-rpc-usb-uart 入り）のファームウェアが書き込まれているか確認し、必要なら焼き直してください。",
        monitorAvailable: false,
        editorAvailable: false,
      };
    case "busy_or_already_open":
      return {
        title: "USBポートが使用中",
        body: "Web Serialポートが他のタブ・アプリ（別のブラウザタブ、シリアルモニター等）に掴まれています。他の接続を閉じてから再試行してください。",
        monitorAvailable,
        editorAvailable,
      };
  }
}
