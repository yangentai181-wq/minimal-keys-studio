import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StudioConnectionOverview } from "./StudioConnectionOverview";
import { createMonitorStore } from "./monitor/monitorStore";
import { useTrackballPrecision } from "./trackball/TrackballPrecisionContext";

const confirmed = {
  schemaVersion: 1,
  normalCpi: 800,
  precisionCpi: 200,
  enabled: true,
  selectedPosition: 5,
  originalBinding: null,
  revision: 1,
  precisionActive: false,
  currentCpi: 800,
};

const precisionContext = (overrides = {}) => ({
  availability: "available" as const,
  confirmed,
  draft: { normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 5 },
  dirty: false,
  saving: false,
  error: null,
  updateDraft: vi.fn(),
  save: vi.fn(),
  reload: vi.fn(),
  ...overrides,
});

function monitorStore() {
  return createMonitorStore((notify) => {
    notify();
    return () => {};
  });
}

vi.mock("./trackball/TrackballPrecisionContext", () => ({
  useTrackballPrecision: vi.fn(),
}));

describe("StudioConnectionOverview", () => {
  it("shows four compact icon statuses while keeping details available", () => {
    render(
      <StudioConnectionOverview
        monitorStore={monitorStore()}
        monitorActive
        editorAvailable
        connectionTitle="接続中"
        connectionBody="編集とモニターを利用できます。"
      />,
    );

    const summary = screen.getByRole("list", { name: "接続状況の概要" });
    expect(within(summary).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("右手USBモニター: 接続中")).toHaveClass(
      "h-10",
      "w-10",
    );
    expect(
      screen.getByRole("button", { name: "接続の詳細" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps connection details collapsed until requested and bounds their scroll surface", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext());
    render(
      <StudioConnectionOverview
        monitorStore={monitorStore()}
        monitorActive={false}
        editorAvailable
        connectionTitle="エディター利用可"
        connectionBody="Studio RPCで接続中です。"
      />,
    );

    expect(screen.getByText("Studio RPCで接続中です。")).toBeInTheDocument();
    expect(screen.queryByText("ライブ読み取り")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.queryByText("ライブ読み取り")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("connection-details")).toHaveClass("max-h-[min(45dvh,360px)]", "overflow-y-auto");
  });

  it("routes confirmed precision status through the connected overview and updates notification state", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext());
    const props = {
      monitorStore: monitorStore(),
      monitorActive: false,
      editorAvailable: true,
      connectionTitle: "エディター利用可",
      connectionBody: "Studio RPCで接続中です。",
    };
    const view = render(<StudioConnectionOverview {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByRole("region", { name: "トラックボール精密モード" })).toHaveTextContent("通常");

    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext({
      confirmed: { ...confirmed, precisionActive: true, currentCpi: 200 },
    }));
    view.rerender(<StudioConnectionOverview {...props} />);

    expect(screen.getByRole("region", { name: "トラックボール精密モード" })).toHaveTextContent("精密");
    expect(screen.getByText("現在の CPI").parentElement).toHaveTextContent("200");
  });

  it("does not mount precision status without an editor connection or available firmware", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext());
    const props = {
      monitorStore: monitorStore(),
      monitorActive: true,
      editorAvailable: false,
      connectionTitle: "Raw HIDで監視中",
      connectionBody: "エディターは未接続です。",
    };
    const view = render(<StudioConnectionOverview {...props} />);

    expect(screen.queryByRole("region", { name: "トラックボール精密モード" })).not.toBeInTheDocument();

    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext({
      availability: "firmware-update-required",
    }));
    view.rerender(<StudioConnectionOverview {...props} editorAvailable />);

    expect(screen.queryByRole("region", { name: "トラックボール精密モード" })).not.toBeInTheDocument();
  });

  it("renders real editor and monitor status from props", () => {
    render(
      <StudioConnectionOverview
        monitorStore={(() => {
          const store = monitorStore();
          store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 0b1000 });
          store.push({ kind: "key", position: 30, pressed: true });
          store.push({ kind: "pointer", dx: 12, dy: -4, wheel: 0, hwheel: 0, buttons: 0 });
          return store;
        })()}
        monitorActive
        editorAvailable
        connectionTitle="エディター利用可"
        connectionBody="Raw HIDとStudio RPCが同じ画面で使えます。"
        deviceName="minimal-keys"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByText("右手USBモニター")).toBeTruthy();
    expect(screen.getByText("minimal-keys を編集中")).toBeTruthy();
    expect(screen.getByText("記号")).toBeTruthy();
    expect(screen.getByText("#30 /")).toBeTruthy();
    expect(screen.getAllByText("dx +12 / dy -4").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).not.toBeInTheDocument();
  });

  it("offers action content when supplied", () => {
    render(
      <StudioConnectionOverview
        monitorStore={monitorStore()}
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
