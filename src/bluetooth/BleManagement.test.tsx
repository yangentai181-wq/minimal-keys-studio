import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BleManagement } from "./BleManagement";

const mocks = vi.hoisted(() => {
  const callRPC = vi.fn();
  return {
    callRPC,
    subsystem: { subsystemIndex: 1, callRPC },
    toast: vi.fn(),
  };
});

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => mocks.subsystem,
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
      if (data[0] === 1) return { getProfiles: { profiles: [{ index: 0, name: "Mac", isActive: true, isConnected: true, isOpen: false, address: "AA:BB" }], maxProfiles: 4 } };
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

  it("toasts only after profile name setting and refresh succeed", async () => {
    mocks.callRPC.mockImplementation(async (request: Uint8Array) => request);
    render(<BleManagement />);

    fireEvent.click(await screen.findByText("Mac"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Work Mac" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("プロファイル名を保存しました", "success"));
  });

  it("does not toast success when profile refresh fails", async () => {
    let calls = 0;
    mocks.callRPC.mockImplementation(async (request: Uint8Array) => {
      calls++;
      if (calls === 5) throw new Error("offline");
      return request;
    });
    render(<BleManagement />);

    fireEvent.click(await screen.findByText("Mac"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Work Mac" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalledWith("プロファイル名を保存しました", "success");
  });

  it("does not toast success when profile name setting fails", async () => {
    let calls = 0;
    mocks.callRPC.mockImplementation(async (request: Uint8Array) => {
      calls++;
      if (calls === 4) throw new Error("offline");
      return request;
    });
    render(<BleManagement />);

    fireEvent.click(await screen.findByText("Mac"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Work Mac" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalledWith("プロファイル名を保存しました", "success");
  });
});
