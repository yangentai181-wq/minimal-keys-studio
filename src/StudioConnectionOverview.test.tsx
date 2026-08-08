import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { StudioConnectionOverview } from "./StudioConnectionOverview";
import { UnifiedStudioPreview } from "./UnifiedStudioPreview";
import {
  MonitorKeymapProvider,
  usePublishMonitorKeymap,
} from "./keyboard/MonitorKeymapContext";
import { createMonitorStore } from "./monitor/monitorStore";
import { useTrackballPrecision } from "./trackball/TrackballPrecisionContext";

const { behaviorMap } = vi.hoisted(() => ({
  behaviorMap: {
    1: { id: 1, displayName: "Key Press", metadata: [] },
    2: { id: 2, displayName: "To Layer", metadata: [] },
  },
}));

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

vi.mock("./behaviors/BehaviorsContext", () => ({
  useBehaviorMap: () => behaviorMap,
}));

function keymapWithL4ReturnBinding(): Keymap {
  const binding = (behaviorId: number, param1 = 0, param2 = 0) => ({
    behaviorId,
    param1,
    param2,
  });
  const bindings = (first = binding(1, (7 << 16) + 4)) =>
    Array.from({ length: 43 }, (_, position) =>
      position === 0 ? first : binding(1, (7 << 16) + 4),
    );

  return {
    layers: [
      { id: 0, name: "Base", bindings: bindings() },
      { id: 4, name: "Auto Mouse", bindings: bindings(binding(2, 0)) },
    ],
    availableLayers: 9,
    maxLayerNameLength: 16,
  };
}

function keymapWithReorderedCustomLayerNames(): Keymap {
  const binding = (behaviorId: number, param1 = 0, param2 = 0) => ({
    behaviorId,
    param1,
    param2,
  });
  const bindings = Array.from({ length: 43 }, () =>
    binding(1, (7 << 16) + 4),
  );

  return {
    layers: [
      { id: 0, name: "Base", bindings },
      { id: 8, name: "精密カスタム", bindings },
      { id: 3, name: "記号カスタム", bindings },
    ],
    availableLayers: 9,
    maxLayerNameLength: 16,
  };
}

function MonitorKeymapPublisher({ keymap }: { keymap: Keymap | undefined }) {
  usePublishMonitorKeymap(keymap);
  return null;
}

function overviewWithMonitorKeymap(
  props: ComponentProps<typeof StudioConnectionOverview>,
  keymap?: Keymap,
  publish = true,
) {
  return (
    <MonitorKeymapProvider>
      {publish && <MonitorKeymapPublisher keymap={keymap} />}
      <StudioConnectionOverview {...props} />
    </MonitorKeymapProvider>
  );
}

describe("StudioConnectionOverview", () => {
  it("shows four compact icon statuses while keeping details available", () => {
    render(
      overviewWithMonitorKeymap({
        monitorStore: monitorStore(),
        monitorActive: true,
        editorAvailable: true,
        connectionTitle: "接続中",
        connectionBody: "編集とモニターを利用できます。",
      }),
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
      overviewWithMonitorKeymap({
        monitorStore: monitorStore(),
        monitorActive: false,
        editorAvailable: true,
        connectionTitle: "エディター利用可",
        connectionBody: "Studio RPCで接続中です。",
      }),
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
    const view = render(overviewWithMonitorKeymap(props));
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByRole("region", { name: "トラックボール精密モード" })).toHaveTextContent("通常");

    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext({
      confirmed: { ...confirmed, precisionActive: true, currentCpi: 200 },
    }));
    view.rerender(overviewWithMonitorKeymap(props));

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
    const view = render(overviewWithMonitorKeymap(props));

    expect(screen.queryByRole("region", { name: "トラックボール精密モード" })).not.toBeInTheDocument();

    vi.mocked(useTrackballPrecision).mockReturnValue(precisionContext({
      availability: "firmware-update-required",
    }));
    view.rerender(
      overviewWithMonitorKeymap({ ...props, editorAvailable: true }),
    );

    expect(screen.queryByRole("region", { name: "トラックボール精密モード" })).not.toBeInTheDocument();
  });

  it("renders real editor and monitor status from props", () => {
    render(
      overviewWithMonitorKeymap({
        monitorStore: (() => {
          const store = monitorStore();
          store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 0b1000 });
          store.push({ kind: "key", position: 30, pressed: true });
          store.push({ kind: "pointer", dx: 12, dy: -4, wheel: 0, hwheel: 0, buttons: 0 });
          return store;
        })(),
        monitorActive: true,
        editorAvailable: true,
        connectionTitle: "エディター利用可",
        connectionBody: "Raw HIDとStudio RPCが同じ画面で使えます。",
        deviceName: "minimal-keys",
      }),
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
      overviewWithMonitorKeymap({
        monitorStore: monitorStore(),
        monitorActive: false,
        editorAvailable: true,
        connectionTitle: "エディター利用可",
        connectionBody: "モニターは未接続です。",
        actions: <button type="button">右手USBモニターを接続</button>,
      }),
    );

    expect(screen.getByRole("button", { name: "右手USBモニターを接続" })).toBeTruthy();
    expect(screen.getByText("モニターは未接続です。")).toBeTruthy();
  });

  it("shows the resolved editor binding for the monitor's latest key", () => {
    const store = monitorStore();
    store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 0b10001 });
    store.push({ kind: "key", position: 0, pressed: true });

    render(
      overviewWithMonitorKeymap(
        {
          monitorStore: store,
          monitorActive: true,
          editorAvailable: true,
          connectionTitle: "エディター利用可",
          connectionBody: "Raw HIDとStudio RPCが同じ画面で使えます。",
        },
        keymapWithL4ReturnBinding(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByText("#0 通常へ戻る")).toBeInTheDocument();
  });

  it("shows the most recent released key and stops stale pointer copy", () => {
    const store = monitorStore();
    store.push({ kind: "key", position: 7, pressed: true });
    store.push({ kind: "key", position: 3, pressed: true });
    store.push({ kind: "key", position: 7, pressed: false });
    store.push(
      { kind: "pointer", dx: 4, dy: -2, wheel: 0, hwheel: 0, buttons: 0 },
      Date.now() - 501,
    );

    render(
      overviewWithMonitorKeymap({
        monitorStore: store,
        monitorActive: true,
        editorAvailable: true,
        connectionTitle: "エディター利用可",
        connectionBody: "Raw HIDとStudio RPCが同じ画面で使えます。",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByText("#7 I")).toBeInTheDocument();
    expect(screen.getByText("直近の移動")).toBeInTheDocument();
    expect(screen.getAllByText("停止中").length).toBeGreaterThan(0);
  });

  it("keeps the resolved live key after the keymap publisher unmounts", () => {
    const store = monitorStore();
    store.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 0b10001 });
    store.push({ kind: "key", position: 0, pressed: true });
    const props = {
      monitorStore: store,
      monitorActive: true,
      editorAvailable: true,
      connectionTitle: "エディター利用可",
      connectionBody: "Raw HIDとStudio RPCが同じ画面で使えます。",
    };
    const view = render(
      overviewWithMonitorKeymap(props, keymapWithL4ReturnBinding()),
    );
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByText("#0 通常へ戻る")).toBeInTheDocument();

    view.rerender(overviewWithMonitorKeymap(props, undefined, false));

    expect(screen.getByText("#0 通常へ戻る")).toBeInTheDocument();
  });

  it("uses the array-priority live name for reordered active layer IDs", () => {
    const store = monitorStore();
    store.push({
      kind: "layer",
      defaultLayer: 0,
      activeLayerMask: (1 << 0) | (1 << 3) | (1 << 8),
    });

    render(
      overviewWithMonitorKeymap(
        {
          monitorStore: store,
          monitorActive: true,
          editorAvailable: true,
          connectionTitle: "エディター利用可",
          connectionBody: "Raw HIDとStudio RPCが同じ画面で使えます。",
        },
        keymapWithReorderedCustomLayerNames(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByText("現在レイヤー").parentElement).toHaveTextContent(
      "記号カスタム",
    );
  });

  it("uses factory-mask resolution for the static latest-key fallback", () => {
    const store = monitorStore();
    store.push({
      kind: "layer",
      defaultLayer: 0,
      activeLayerMask: (1 << 0) | (1 << 3) | (1 << 8),
    });
    store.push({ kind: "key", position: 0, pressed: true });

    render(
      overviewWithMonitorKeymap({
        monitorStore: store,
        monitorActive: true,
        editorAvailable: false,
        connectionTitle: "Raw HIDで監視中",
        connectionBody: "編集接続は利用できません。",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "接続の詳細" }));

    expect(screen.getByText("最新キー").parentElement).toHaveTextContent(
      "#0 Cmd+0",
    );
  });

  it("keeps the integrated preview renderable without an editor keymap", () => {
    expect(() => render(<UnifiedStudioPreview />)).not.toThrow();
    expect(screen.getByText("エディタ / モニタ統合")).toBeInTheDocument();
  });
});
