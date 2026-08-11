import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceSettings } from "./DeviceSettings";

const mocks = vi.hoisted(() => ({ callRPC: vi.fn(), toast: vi.fn() }));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => ({ subsystemIndex: 1, callRPC: mocks.callRPC }),
  useCustomNotification: () => undefined,
}));
vi.mock("../misc/Toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../telemetry/TelemetryProvider", () => ({ useTelemetry: () => ({ isOptedIn: false, setOptedIn: vi.fn() }) }));

describe("DeviceSettings", () => {
  beforeEach(() => { mocks.callRPC.mockReset(); mocks.toast.mockReset(); });

  it("shows applied feedback only after setting and refresh both succeed", async () => {
    mocks.callRPC.mockResolvedValue(undefined);
    render(<DeviceSettings />);
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    expect(await screen.findByRole("button", { name: "適用済み" })).toBeEnabled();
  });

  it("does not show applied feedback when refresh fails", async () => {
    mocks.callRPC.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("offline"));
    render(<DeviceSettings />);
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "適用済み" })).not.toBeInTheDocument();
  });
});
