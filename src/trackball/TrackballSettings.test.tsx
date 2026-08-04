import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackballSettings } from "./TrackballSettings";

const mocks = vi.hoisted(() => ({
  subsystem: null as { subsystemIndex: number; callRPC: ReturnType<typeof vi.fn> } | null,
  toast: vi.fn(),
}));

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => mocks.subsystem,
  useCustomNotification: () => undefined,
}));

vi.mock("../misc/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("./TrackballPrecisionSettings", () => ({
  TrackballPrecisionSettings: () => (
    <section aria-label="精密モード設定">
      <h3>精密モード</h3>
    </section>
  ),
}));

describe("TrackballSettings", () => {
  beforeEach(() => {
    mocks.subsystem = {
      subsystemIndex: 1,
      callRPC: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("places precision settings before the existing rotation, inversion, and scroll controls", () => {
    const { container } = render(<TrackballSettings />);

    const root = container.firstElementChild!;
    const precision = screen.getByRole("region", { name: "精密モード設定" });
    expect(root.querySelector("section")).toBe(precision);

    const rotation = screen.getByRole("spinbutton", { name: "度" });
    const xInvert = screen.getByRole("checkbox", { name: "X軸を反転" });
    const scrollMode = screen.getByRole("checkbox", { name: "スクロールモード" });
    expect(screen.getByRole("heading", { name: "回転角度" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "軸の設定" })).toBeVisible();

    fireEvent.change(rotation, { target: { value: "45" } });
    fireEvent.click(xInvert);
    fireEvent.click(scrollMode);

    expect(rotation).toHaveValue(45);
    expect(xInvert).toBeChecked();
    expect(scrollMode).toBeChecked();
  });

  it("keeps precision settings visible when the legacy runtime subsystem is unavailable", () => {
    mocks.subsystem = null;
    const { container } = render(<TrackballSettings />);

    const root = container.firstElementChild!;
    const precision = screen.getByRole("region", { name: "精密モード設定" });
    expect(root.firstElementChild).toBe(precision);
    expect(screen.getByRole("heading", { name: "トラックボール設定は利用できません" })).toBeVisible();
  });
});
