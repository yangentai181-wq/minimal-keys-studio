import type { SplitInfo } from "../proto/ble";

export interface SplitConnectionPresentation {
  label: string;
  state: "connected" | "unknown";
  detail: string;
}

export function presentSplitConnection(
  info: SplitInfo,
): SplitConnectionPresentation {
  if (info.peripheralConnected) {
    return {
      label: "接続中",
      state: "connected",
      detail: "左手から右手へ入力を送れる状態です。",
    };
  }

  return {
    label: "未接続または判定不能",
    state: "unknown",
    detail:
      "左手のキー入力で接続を確認してください。表示だけでは切断と断定できません。",
  };
}
