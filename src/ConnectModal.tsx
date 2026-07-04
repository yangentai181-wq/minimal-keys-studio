import { useCallback, useEffect, useMemo, useState } from "react";
import { Bluetooth, Cable, Loader2, RefreshCw, Usb } from "lucide-react";

import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors";
import { useModalRef } from "./misc/useModalRef";
import { GenericModal } from "./GenericModal";
import type { AvailableDevice } from "./tauri";

export type TransportFactory = {
  label: string;
  isWireless?: boolean;
  connect?: () => Promise<RpcTransport>;
  pick_and_connect?: {
    list: () => Promise<Array<AvailableDevice>>;
    connect: (dev: AvailableDevice) => Promise<RpcTransport>;
  };
};

type TransportCreatedHandler = (
  t: RpcTransport,
  isWireless?: boolean,
) => Promise<void> | void;

export interface ConnectModalProps {
  open?: boolean;
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
  /**
   * Right-hand USB main flow (WebHID monitor + Studio RPC probe).
   * When provided, this is rendered as the primary button and the
   * transport list is demoted to a secondary "detailed" section.
   */
  onConnectRightUsb?: () => Promise<void>;
  /** Latest coordinator message ("which contract was established"). */
  connectionNotice?: { title: string; body: string };
}

function getConnectionErrorMessage(error: unknown): string | undefined {
  if (error instanceof UserCancelledError) {
    return undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "接続中にエラーが発生しました。";
}

function ConnectionErrorNotice({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
      role="alert"
    >
      {message}
    </p>
  );
}

const RIGHT_USB_LABEL = "__right_usb__";

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
        badge: "wireless",
        Icon: Bluetooth,
      }
    : {
        title: "USBシリアルで接続",
        connecting: "USB 接続中...",
        description: "エディターのみ（Studio RPC）。通常は右手USBで接続",
        badge: "stable",
        Icon: Cable,
      };
}

function SimpleDevicePicker({
  transports,
  onTransportCreated,
  onConnectRightUsb,
  connectionNotice,
}: {
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
  onConnectRightUsb?: () => Promise<void>;
  connectionNotice?: { title: string; body: string };
}) {
  const [connectingLabel, setConnectingLabel] = useState<string | undefined>(
    undefined,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const connectRightUsb = useCallback(async () => {
    if (!onConnectRightUsb) {
      return;
    }
    setConnectingLabel(RIGHT_USB_LABEL);
    setErrorMessage(undefined);
    try {
      await onConnectRightUsb();
    } catch (e) {
      console.error(e);
      const message = getConnectionErrorMessage(e);
      if (message) {
        setErrorMessage(message);
      }
    } finally {
      setConnectingLabel(undefined);
    }
  }, [onConnectRightUsb]);

  const connectTransport = useCallback(
    async (selectedTransport: TransportFactory) => {
      setConnectingLabel(selectedTransport.label);
      setErrorMessage(undefined);
      try {
        const transport = await selectedTransport.connect?.();

        if (transport) {
          await onTransportCreated(transport, selectedTransport.isWireless);
        }
      } catch (e) {
        console.error(e);
        const message = getConnectionErrorMessage(e);
        if (message) {
          setErrorMessage(message);
        }
      } finally {
        setConnectingLabel(undefined);
      }
    },
    [onTransportCreated],
  );

  // USB (stable, editor probe) before BLE (auxiliary) in the fallback list.
  const orderedTransports = useMemo(
    () =>
      [...transports].sort(
        (a, b) =>
          Number(isWirelessTransport(a)) - Number(isWirelessTransport(b)),
      ),
    [transports],
  );

  const connections = orderedTransports.map((t) => {
    const copy = getTransportCopy(t);
    const isConnecting = connectingLabel === t.label;
    const Icon = copy.Icon;

    return (
      <li key={t.label} className="list-none">
        <button
          className="group flex min-h-16 w-full items-center gap-3 rounded-xl border border-base-300 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          type="button"
          aria-label={
            isConnecting ? copy.connecting : `${copy.title} ${copy.description}`
          }
          onClick={() => connectTransport(t)}
          disabled={connectingLabel !== undefined}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isConnecting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
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
  });
  const isRightUsbConnecting = connectingLabel === RIGHT_USB_LABEL;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-base-content">
          キーボードを接続
        </h2>
        <p className="mt-1 text-sm text-base-content/60">
          {onConnectRightUsb
            ? "右手側（ケーブルを挿す側）をUSBでつないで接続してください。"
            : "電源を入れて、接続方法を選んでください。"}
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
      {onConnectRightUsb && (
        <button
          className="group flex min-h-20 w-full items-center gap-3 rounded-xl border-2 border-primary/50 bg-primary/5 px-4 py-3 text-left shadow-sm transition-colors hover:border-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          type="button"
          aria-label={
            isRightUsbConnecting
              ? "右手USB 接続中..."
              : "右手USBで接続 モニターとエディターをまとめて接続（推奨）"
          }
          onClick={connectRightUsb}
          disabled={connectingLabel !== undefined}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-content">
            {isRightUsbConnecting ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Usb className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold text-base-content">
              {isRightUsbConnecting ? "右手USB 接続中..." : "右手USBで接続"}
            </span>
            <span className="mt-0.5 block text-xs text-base-content/60">
              モニターとエディターをまとめて接続（推奨）
            </span>
          </span>
        </button>
      )}
      {onConnectRightUsb ? (
        <details className="rounded-xl border border-base-300 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-base-content/70">
            詳細な接続方法（BLE / USBシリアルのみ）
          </summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">{connections}</ul>
        </details>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{connections}</ul>
      )}
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
  const [devices, setDevices] = useState<
    Array<[TransportFactory, AvailableDevice]>
  >([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const loadDevices = useCallback(async () => {
    setRefreshing(true);
    const entries: Array<[TransportFactory, AvailableDevice]> = [];
    for (const t of transports.filter((t) => t.pick_and_connect)) {
      try {
        const devs = await t.pick_and_connect?.list();
        if (!devs) continue;
        entries.push(
          ...devs.map<[TransportFactory, AvailableDevice]>((d) => [t, d]),
        );
      } catch (e) {
        console.error(`Failed to list ${t.label} devices:`, e);
      }
    }
    setDevices(entries);
    setSelectedIndex(null);
    setRefreshing(false);
  }, [transports]);

  useEffect(() => {
    if (open) {
      loadDevices();
    }
  }, [open, loadDevices]);

  const connectToSelected = useCallback(async () => {
    if (selectedIndex === null) return;
    const [transport, device] = devices[selectedIndex];
    setConnecting(true);
    setErrorMessage(undefined);
    try {
      const rpcTransport = await transport.pick_and_connect!.connect(device);
      await onTransportCreated(rpcTransport, transport.isWireless);
    } catch (e) {
      console.error("Failed to connect:", e);
      const message = getConnectionErrorMessage(e);
      if (message) {
        setErrorMessage(message);
      }
    } finally {
      setConnecting(false);
    }
  }, [selectedIndex, devices, onTransportCreated]);

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
          onClick={loadDevices}
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
                onDoubleClick={() => {
                  setSelectedIndex(index);
                  connectToSelected();
                }}
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
        onClick={connectToSelected}
        disabled={selectedIndex === null || connecting}
      >
        {connecting ? "接続中..." : "接続"}
      </button>
    </div>
  );
}

function NoTransportsPrompt() {
  return (
    <div className="rounded-xl border border-base-300 bg-white px-4 py-3 text-sm text-base-content/70">
      <p>
        お使いのブラウザはWeb Serial / Web
        Bluetoothに対応していません。Chrome（バージョン89以降）をお使いください。またはデスクトップアプリをご利用ください。
      </p>

      <div className="mt-2">
        <p>
          minimal-keys
          カスタマイズを使うには、対応ブラウザまたはデスクトップアプリが必要です。
        </p>
      </div>
    </div>
  );
}

function ConnectOptions({
  transports,
  onTransportCreated,
  open,
  onConnectRightUsb,
  connectionNotice,
}: {
  transports: TransportFactory[];
  onTransportCreated: TransportCreatedHandler;
  open?: boolean;
  onConnectRightUsb?: () => Promise<void>;
  connectionNotice?: { title: string; body: string };
}) {
  const useSimplePicker = useMemo(
    () => transports.every((t) => !t.pick_and_connect),
    [transports],
  );

  return useSimplePicker ? (
    <SimpleDevicePicker
      transports={transports}
      onTransportCreated={onTransportCreated}
      onConnectRightUsb={onConnectRightUsb}
      connectionNotice={connectionNotice}
    />
  ) : (
    <DeviceList
      open={open || false}
      transports={transports}
      onTransportCreated={onTransportCreated}
    />
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

  const haveTransports = useMemo(
    () => transports.length > 0 || !!onConnectRightUsb,
    [transports, onConnectRightUsb],
  );

  return (
    <GenericModal
      ref={dialog}
      className="w-[min(92vw,34rem)] p-0 backdrop:bg-base-200"
    >
      <div className="border-b border-base-300 px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}minimal-keys-logo.png`}
            alt="minimal-keys"
            className="h-12 w-12 rounded-xl shadow-sm"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              minimal-keys studio
            </p>
            <h1 className="text-xl font-bold text-base-content">
              minimal-keys カスタマイズ
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-base-content/65">
          接続後にキーマップ、トラックボール、コンボ、Bluetooth設定を編集できます。
        </p>
      </div>
      <div className="px-5 py-5">
        {haveTransports ? (
          <ConnectOptions
            transports={transports}
            onTransportCreated={onTransportCreated}
            open={open}
            onConnectRightUsb={onConnectRightUsb}
            connectionNotice={connectionNotice}
          />
        ) : (
          <NoTransportsPrompt />
        )}
      </div>
    </GenericModal>
  );
};
