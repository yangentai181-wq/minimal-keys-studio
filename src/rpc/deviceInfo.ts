import type {
  Request,
  RequestResponse,
  RpcConnection,
} from "@zmkfirmware/zmk-studio-ts-client";
import type { GetDeviceInfoResponse } from "@zmkfirmware/zmk-studio-ts-client/core";

type DeviceInfoRpcCall = (
  conn: RpcConnection,
  req: Omit<Request, "requestId">,
) => Promise<RequestResponse>;

export type DeviceInfoTransport = "usb" | "ble";

export type DeviceInfoOptions = {
  transport?: DeviceInfoTransport;
};

export class DeviceInfoTimeoutError extends Error {
  constructor(timeoutMs: number, transport: DeviceInfoTransport = "usb") {
    const seconds = Math.ceil(timeoutMs / 1000);
    const message =
      transport === "ble"
        ? `キーボードから応答がありません。BLE接続を解除して、${seconds}秒ほど待ってからもう一度接続してください。`
        : `キーボードから応答がありません。USBシリアルは開けましたが Studio RPC の応答がないため、BLEでの接続も試してください。USBで編集したい場合は右側に studio-rpc-usb-uart 対応ファームを書き込んでください。`;
    super(message);
    Object.setPrototypeOf(this, DeviceInfoTimeoutError.prototype);
  }
}

export class DeviceInfoRequestError extends Error {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.originalError = originalError;
    Object.setPrototypeOf(this, DeviceInfoRequestError.prototype);
  }
}

export async function requestDeviceInfo(
  conn: RpcConnection,
  timeoutMs: number,
  call: DeviceInfoRpcCall,
  options: DeviceInfoOptions = {},
): Promise<GetDeviceInfoResponse> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const transport = options.transport ?? "usb";

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new DeviceInfoTimeoutError(timeoutMs, transport)),
      timeoutMs,
    );
  });

  try {
    const response = await Promise.race([
      call(conn, { core: { getDeviceInfo: true } }),
      timeout,
    ]);
    const details = response.core?.getDeviceInfo;

    if (!details) {
      throw new DeviceInfoRequestError(
        "キーボードからデバイス情報が返りませんでした。ZMK Studio対応のファームウェアか確認してください。",
      );
    }

    return details;
  } catch (error) {
    if (
      error instanceof DeviceInfoTimeoutError ||
      error instanceof DeviceInfoRequestError
    ) {
      throw error;
    }

    throw new DeviceInfoRequestError(
      "キーボードとの初期通信に失敗しました。USB接続をやり直してください。",
      error,
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
