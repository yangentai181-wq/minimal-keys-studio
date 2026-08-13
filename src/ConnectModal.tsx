import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bluetooth,
  Cable,
  ChevronRight,
  Loader2,
  RefreshCw,
  Usb,
} from "lucide-react";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

import { BrandLockup } from "./brand/BrandLockup";
import identity from "./brand/identity.json";
import { AutoConnectError, autoConnectUsb } from "./connect/autoConnectUsb";
import {
  getAutoConnectFailureText,
  usbAutoConnectSearchingText,
} from "./connect/ja";
import { normalizeConnectionError } from "./copy/connectionErrors";
import { GenericModal } from "./GenericModal";
import { useModalRef } from "./misc/useModalRef";
import type { AvailableDevice } from "./tauri";

export type TransportFactory = {
  label: string;
  isWireless?: boolean;
  connect?: () => Promise<RpcTransport>;
  pick_and_connect?: {
    list: () => Promise<Array<AvailableDevice>>;
    connect: (device: AvailableDevice) => Promise<RpcTransport>;
  };
};

type TransportCreatedHandler = (
  transport: RpcTransport,
  isWireless?: boolean,
) => boolean | void | Promise<boolean | void>;

export interface ConnectModalProps {
  open?: boolean;
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
  onConnectRightUsb?: () => Promise<void>;
  connectionNotice?: { title: string; body: string };
}

function ConnectionErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
      role="alert"
    >
      {message}
    </p>
  );
}

function isWirelessTransport(transport: TransportFactory): boolean {
  return transport.isWireless || transport.label.toUpperCase() === "BLE";
}

function getTransportCopy(transport: TransportFactory) {
  const isBle = isWirelessTransport(transport);
  return isBle
    ? {
        title: "BLEで接続",
        connecting: "BLE 接続中...",
        description: "補助経路。ワイヤレスで編集のみ（モニター不可）",
        Icon: Bluetooth,
      }
    : {
        title: "USBシリアルで接続",
        connecting: "USB 接続中...",
        description: "エディターのみ（Studio RPC）。通常は右手USBで接続",
        Icon: Cable,
      };
}

function RightUsbPrimary({
  onConnect,
  connectionNotice,
}: {
  onConnect: () => Promise<void>;
  connectionNotice?: { title: string; body: string };
}) {
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const connect = useCallback(async () => {
    setConnecting(true);
    setErrorMessage(undefined);
    try {
      await onConnect();
    } catch (error) {
      console.error(error);
      setErrorMessage(normalizeConnectionError(error));
    } finally {
      setConnecting(false);
    }
  }, [onConnect]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-base-content">
          キーボードを接続
        </h2>
        <p className="mt-1 text-sm text-base-content/60">
          右手側（ケーブルを挿す側）をUSBでつないで接続してください。
        </p>
      </div>
      <ConnectionErrorNotice message={errorMessage} />
      {connectionNotice && (
        <div
          className="rounded-xl border border-base-300 bg-base-200/60 px-4 py-3"
          role="status"
        >
          <p className="text-sm font-semibold text-base-content">
            {connectionNotice.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-base-content/70">
            {connectionNotice.body}
          </p>
        </div>
      )}
      <button
        className="group flex min-h-20 w-full items-center gap-3 rounded-xl border-2 border-primary/50 bg-primary/5 px-4 py-3 text-left shadow-sm transition-colors hover:border-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        type="button"
        aria-label={
          connecting
            ? "右手USB 接続中..."
            : "右手USBで接続 モニターとエディターをまとめて接続（推奨）"
        }
        onClick={() => void connect()}
        disabled={connecting}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-content">
          {connecting ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <Usb className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-base font-bold text-base-content">
            {connecting ? "右手USB 接続中..." : "右手USBで接続"}
          </span>
          <span className="mt-0.5 block text-xs text-base-content/60">
            モニターとエディターをまとめて接続（推奨）
          </span>
        </span>
      </button>
    </div>
  );
}

function SimpleDevicePicker({
  transports,
  onTransportCreated,
}: {
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
}) {
  const [connectingLabel, setConnectingLabel] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const orderedTransports = useMemo(
    () =>
      [...transports].sort(
        (left, right) =>
          Number(isWirelessTransport(left)) -
          Number(isWirelessTransport(right)),
      ),
    [transports],
  );

  const connectTransport = useCallback(
    async (selectedTransport: TransportFactory) => {
      setConnectingLabel(selectedTransport.label);
      setErrorMessage(undefined);
      try {
        const transport = await selectedTransport.connect?.();
        if (transport) {
          await onTransportCreated(transport, selectedTransport.isWireless);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(normalizeConnectionError(error));
      } finally {
        setConnectingLabel(undefined);
      }
    },
    [onTransportCreated],
  );

  return (
    <div className="space-y-3">
      <ConnectionErrorNotice message={errorMessage} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {orderedTransports.map((transport) => {
          const copy = getTransportCopy(transport);
          const isConnecting = connectingLabel === transport.label;
          const Icon = copy.Icon;
          return (
            <li key={transport.label} className="list-none">
              <button
                className="group flex min-h-16 w-full items-center gap-3 rounded-xl border border-base-300 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                type="button"
                aria-label={
                  isConnecting
                    ? copy.connecting
                    : `${copy.title} ${copy.description}`
                }
                onClick={() => void connectTransport(transport)}
                disabled={connectingLabel !== undefined}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {isConnecting ? (
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-base-content">
                    {isConnecting ? copy.connecting : copy.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-base-content/60">
                    {copy.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DeviceList({
  open,
  transports,
  onTransportCreated,
}: {
  open: boolean;
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
}) {
  const [devices, setDevices] = useState<Array<[TransportFactory, AvailableDevice]>>(
    [],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const loadDevices = useCallback(async () => {
    setRefreshing(true);
    const entries: Array<[TransportFactory, AvailableDevice]> = [];
    for (const transport of transports.filter(
      (candidate) => candidate.pick_and_connect,
    )) {
      try {
        const devicesForTransport = await transport.pick_and_connect?.list();
        if (!devicesForTransport) continue;
        entries.push(
          ...devicesForTransport.map<[TransportFactory, AvailableDevice]>(
            (device) => [transport, device],
          ),
        );
      } catch (error) {
        console.error(`Failed to list ${transport.label} devices:`, error);
      }
    }
    setDevices(entries);
    setSelectedIndex(null);
    setRefreshing(false);
  }, [transports]);

  useEffect(() => {
    if (open) void loadDevices();
  }, [loadDevices, open]);

  const connectToSelected = useCallback(async () => {
    if (selectedIndex === null) return;
    const [transport, device] = devices[selectedIndex];
    setConnecting(true);
    setErrorMessage(undefined);
    try {
      const rpcTransport = await transport.pick_and_connect!.connect(device);
      await onTransportCreated(rpcTransport, transport.isWireless);
    } catch (error) {
      console.error("Failed to connect:", error);
      setErrorMessage(normalizeConnectionError(error));
    } finally {
      setConnecting(false);
    }
  }, [devices, onTransportCreated, selectedIndex]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-base-content">
            接続するデバイス
          </h2>
          <p className="mt-1 text-sm text-base-content/60">
            見つかったデバイスを選んで接続してください。
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-base-300 bg-white px-3 py-2 text-sm font-medium text-base-content shadow-sm hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          type="button"
          onClick={() => void loadDevices()}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {refreshing ? "スキャン中..." : "更新"}
        </button>
      </div>
      <ConnectionErrorNotice message={errorMessage} />
      {devices.length === 0 && !refreshing && (
        <p className="rounded-xl border border-base-300 bg-white px-4 py-3 text-sm text-base-content/60">
          デバイスが見つかりません。キーボードの電源が入っているか確認してください
        </p>
      )}
      {devices.length > 0 && (
        <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {devices.map(([transport, device], index) => (
            <li key={`${transport.label}-${device.id}`} className="list-none">
              <button
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                  selectedIndex === index
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 bg-white hover:border-primary/40 hover:bg-primary/5"
                }`}
                type="button"
                onClick={() => setSelectedIndex(index)}
              >
                <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {transport.isWireless ? "BLE" : "USB"}
                </span>
                <span>{device.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-content shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={() => void connectToSelected()}
        disabled={selectedIndex === null || connecting}
      >
        {connecting ? "接続中..." : "接続"}
      </button>
    </div>
  );
}

export type ConnectionMethodView =
  | "choose"
  | "usb-searching"
  | "usb-failed"
  | "manual-usb"
  | "wireless";

export interface ConnectionMethodPanelProps {
  view: ConnectionMethodView;
  failureText?: string;
  onUsbConnect: () => void;
  onWirelessConnect: () => void;
  onShowManualUsb: () => void;
  children?: React.ReactNode;
}

export function ConnectionMethodPanel({
  view,
  failureText,
  onUsbConnect,
  onWirelessConnect,
  onShowManualUsb,
  children,
}: ConnectionMethodPanelProps) {
  const isSearching = view === "usb-searching";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="group flex min-h-32 flex-col items-start rounded-lg border border-primary/40 bg-base-200/30 p-4 text-left transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 disabled:cursor-wait disabled:opacity-70"
          type="button"
          onClick={onUsbConnect}
          disabled={isSearching}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base-100">
              <Usb className="h-5 w-5" aria-hidden="true" />
            </span>
            <ChevronRight
              className="h-5 w-5 text-base-content/50 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
          <span className="mt-3 text-base font-semibold">USBでつなぐ</span>
          <span className="mt-1 text-sm text-base-content/60">
            接続先を自動検出します
          </span>
        </button>
        <button
          className="group flex min-h-32 flex-col items-start rounded-lg border border-base-300 bg-base-200/30 p-4 text-left transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
          type="button"
          onClick={onWirelessConnect}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-base-300 text-base-content">
              <Bluetooth className="h-5 w-5" aria-hidden="true" />
            </span>
            <ChevronRight
              className="h-5 w-5 text-base-content/50 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
          <span className="mt-3 text-base font-semibold">
            ワイヤレスでつなぐ
          </span>
          <span className="mt-1 text-sm text-base-content/60">
            BLEでエディターに接続します
          </span>
        </button>
      </div>

      {isSearching && (
        <div
          className="flex min-h-16 items-center gap-3 rounded-lg border border-primary/30 bg-base-200/30 px-4 text-sm"
          role="status"
        >
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <span>{usbAutoConnectSearchingText}</span>
        </div>
      )}
      {view === "usb-failed" && failureText && (
        <div className="rounded-lg border border-warning/50 bg-base-200/30 p-4">
          <p className="text-sm leading-6">{failureText}</p>
          <button
            className="mt-3 min-h-11 rounded-md bg-base-300 px-3 text-sm font-medium transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
            type="button"
            onClick={onShowManualUsb}
          >
            手動で選ぶ
          </button>
        </div>
      )}
      {view === "wireless" && (
        <p className="text-sm text-base-content/60">
          近くのキーボードを選択してください
        </p>
      )}
      {view === "manual-usb" && (
        <p className="text-sm text-base-content/60">
          接続するキーボードを手動で選択してください
        </p>
      )}
      {children}
    </div>
  );
}

function ConnectOptions({
  transports,
  onTransportCreated,
  open,
}: {
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
  open?: boolean;
}) {
  const useSimplePicker = transports.every(
    (transport) => !transport.pick_and_connect,
  );
  return useSimplePicker ? (
    <SimpleDevicePicker
      transports={transports}
      onTransportCreated={onTransportCreated}
    />
  ) : (
    <DeviceList
      open={open || false}
      transports={transports}
      onTransportCreated={onTransportCreated}
    />
  );
}

function NoTransportsPrompt() {
  return (
    <div className="rounded-xl border border-base-300 bg-white px-4 py-3 text-sm text-base-content/70">
      <p>
        お使いのブラウザはWeb Serial / Web
        Bluetoothに対応していません。Chrome（バージョン89以降）をお使いください。またはデスクトップアプリをご利用ください。
      </p>
      <p className="mt-2">
        {identity.productName}を使うには、対応ブラウザまたはデスクトップアプリが必要です。
      </p>
    </div>
  );
}

export const ConnectModal = ({
  open,
  transports,
  onTransportCreated,
  onConnectRightUsb,
  connectionNotice,
}: ConnectModalProps) => {
  const dialog = useModalRef(open || false, false, false);
  const [view, setView] = useState<ConnectionMethodView>("choose");
  const [usbFailureText, setUsbFailureText] = useState<string>();
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setView("choose");
      setUsbFailureText(undefined);
    }
    wasOpen.current = open;
  }, [open]);

  const wirelessTransports = useMemo(
    () => transports.filter(isWirelessTransport),
    [transports],
  );
  const usbTransports = useMemo(
    () => transports.filter((transport) => !isWirelessTransport(transport)),
    [transports],
  );
  const haveTransports = transports.length > 0 || !!onConnectRightUsb;

  const handleUsbConnect = useCallback(async () => {
    setUsbFailureText(undefined);
    setView("usb-searching");
    let transport: RpcTransport;
    try {
      ({ transport } = await autoConnectUsb());
    } catch (error) {
      const reason =
        error instanceof AutoConnectError ? error.reason : "no-response";
      setUsbFailureText(getAutoConnectFailureText(reason));
      setView("usb-failed");
      return;
    }

    try {
      const connected = await onTransportCreated(transport, false);
      if (connected !== false) return;
    } catch {
      // Initialization failures return to the same retryable surface.
    }
    setUsbFailureText("接続できませんでした。もう一度お試しください");
    setView("usb-failed");
  }, [onTransportCreated]);

  const selectedTransports =
    view === "wireless"
      ? wirelessTransports
      : view === "manual-usb"
        ? usbTransports
        : [];
  const methodPanel = (
    <ConnectionMethodPanel
      view={view}
      failureText={usbFailureText}
      onUsbConnect={() => void handleUsbConnect()}
      onWirelessConnect={() => setView("wireless")}
      onShowManualUsb={() => setView("manual-usb")}
    >
      {selectedTransports.length > 0 && (
        <ConnectOptions
          transports={selectedTransports}
          onTransportCreated={onTransportCreated}
          open={open}
        />
      )}
    </ConnectionMethodPanel>
  );

  return (
    <GenericModal
      ref={dialog}
      className="w-[min(92vw,34rem)] p-0 backdrop:bg-base-200"
    >
      <div className="border-b border-base-300 px-5 py-5">
        <BrandLockup tagline={identity.supportedDeviceCopy} />
        <p className="mt-4 text-sm leading-6 text-base-content/65">
          接続後にキーマップ、トラックボール、コンボ、Bluetooth設定を編集できます。
        </p>
      </div>
      <div className="px-5 py-5">
        {!haveTransports ? (
          <NoTransportsPrompt />
        ) : onConnectRightUsb ? (
          <div className="space-y-4">
            <RightUsbPrimary
              onConnect={onConnectRightUsb}
              connectionNotice={connectionNotice}
            />
            <details className="rounded-xl border border-base-300 bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-base-content/70">
                詳細な接続方法（BLE / USBシリアルのみ）
              </summary>
              <div className="mt-3">{methodPanel}</div>
            </details>
          </div>
        ) : (
          methodPanel
        )}
      </div>
    </GenericModal>
  );
};
