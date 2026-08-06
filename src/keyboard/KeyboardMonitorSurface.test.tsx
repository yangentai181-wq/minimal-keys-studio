import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMonitorStore } from "../monitor/monitorStore";
import { KeyboardMonitorSurface } from "./KeyboardMonitorSurface";

describe("KeyboardMonitorSurface", () => {
  it("shows the live keyboard, active layer, latest key, and pointer movement", () => {
    const store = createMonitorStore((notify) => {
      notify();
      return () => {};
    });
    store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 1 });
    store.push({ kind: "key", position: 2, pressed: true });
    store.push({ kind: "holdTap", position: 2, phase: "hold" });
    store.push({
      kind: "pointer",
      dx: 4,
      dy: -2,
      wheel: 0,
      hwheel: 0,
      buttons: 0,
    });

    render(<KeyboardMonitorSurface monitorStore={store} monitorActive />);

    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("pos 2 E 押下中 長押し")).toBeInTheDocument();
    expect(screen.getByText("デフォルト")).toBeInTheDocument();
    expect(screen.getByText("#2 E")).toBeInTheDocument();
    expect(screen.getByText("dx +4 / dy -2")).toBeInTheDocument();
    expect(screen.getByText("接続中")).toBeInTheDocument();
  });

  it("clearly identifies a disconnected monitor", () => {
    render(
      <KeyboardMonitorSurface
        monitorStore={createMonitorStore()}
        monitorActive={false}
      />,
    );

    expect(screen.getByText("モニター未接続")).toBeInTheDocument();
  });
});
