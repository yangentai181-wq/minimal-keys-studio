import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BleManagement } from "./BleManagement";

const mocks = vi.hoisted(() => ({
  callRPC: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => ({ subsystemIndex: 1, callRPC: mocks.callRPC }),
}));

vi.mock("../misc/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../proto/ble", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../proto/ble")>();
  return {
    ...actual,
    encodeGetProfiles: () => Uint8Array.of(1),
    encodeGetSplitInfo: () => Uint8Array.of(2),
    encodeGetOutputPriority: () => Uint8Array.of(3),
    decodeResponse: (data: Uint8Array) => {
      if (data[0] === 1) return { getProfiles: { profiles: [], maxProfiles: 4 } };
      if (data[0] === 2) {
        return {
          getSplitInfo: {
            isSplit: true,
            isCentral: true,
            peripheralConnected: false,
            centralBonded: false,
          },
        };
      }
      return { getOutputPriority: actual.OutputPriority.USB };
    },
  };
});

describe("BleManagement split status", () => {
  beforeEach(() => {
    mocks.callRPC.mockImplementation(async (request: Uint8Array) => request);
    mocks.toast.mockClear();
  });

  it("does not present the central firmware's unknown split state as a confirmed disconnect", async () => {
    render(<BleManagement />);

    expect(await screen.findByText("未接続または判定不能")).toBeVisible();
    expect(
      screen.getByText("左手のキー入力で接続を確認してください。表示だけでは切断と断定できません。"),
    ).toBeVisible();
    expect(screen.queryByText(/^未接続$/)).not.toBeInTheDocument();
  });
});
