import { describe, expect, it } from "vitest";
import { presentSplitConnection } from "./splitConnectionPresentation";

describe("presentSplitConnection", () => {
  it("reports a connected left half when the central confirms it", () => {
    expect(
      presentSplitConnection({
        isSplit: true,
        isCentral: true,
        peripheralConnected: true,
        centralBonded: false,
      }),
    ).toEqual({
      label: "接続中",
      state: "connected",
      detail: "左手から右手へ入力を送れる状態です。",
    });
  });

  it("does not claim disconnected when the central firmware cannot prove the state", () => {
    expect(
      presentSplitConnection({
        isSplit: true,
        isCentral: true,
        peripheralConnected: false,
        centralBonded: false,
      }),
    ).toEqual({
      label: "未接続または判定不能",
      state: "unknown",
      detail: "左手のキー入力で接続を確認してください。表示だけでは切断と断定できません。",
    });
  });
});
