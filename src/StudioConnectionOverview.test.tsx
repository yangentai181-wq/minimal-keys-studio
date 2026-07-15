import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StudioConnectionOverview } from "./StudioConnectionOverview";
import { initialMonitorSnapshot } from "./monitor/monitorStore";

describe("StudioConnectionOverview", () => {
  it("renders real editor and monitor status from props", () => {
    render(
      <StudioConnectionOverview
        monitor={{
          ...initialMonitorSnapshot,
          pressed: new Set([30]),
          activeLayerIndex: 3,
          activeLayerMask: 0b1000,
          pointer: {
            dx: 12,
            dy: -4,
            wheel: 0,
            hwheel: 0,
            buttons: 0,
            at: 100,
          },
        }}
        monitorActive
        editorAvailable
        connectionTitle="エディター利用可"
        connectionBody="Raw HIDとStudio RPCが同じ画面で使えます。"
        deviceName="minimal-keys"
        showLayout
      />,
    );

    expect(screen.getByText("右手USBモニター")).toBeTruthy();
    expect(screen.getByText("minimal-keys を編集中")).toBeTruthy();
    expect(screen.getByText("記号")).toBeTruthy();
    expect(screen.getByText("#30 /")).toBeTruthy();
    expect(screen.getAllByText("dx +12 / dy -4").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("pos 30 / 押下中")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers action content when supplied", () => {
    render(
      <StudioConnectionOverview
        monitor={initialMonitorSnapshot}
        monitorActive={false}
        editorAvailable
        connectionTitle="エディター利用可"
        connectionBody="モニターは未接続です。"
        actions={<button type="button">右手USBモニターを接続</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "右手USBモニターを接続" })).toBeTruthy();
    expect(screen.getByText("モニターは未接続です。")).toBeTruthy();
  });
});
