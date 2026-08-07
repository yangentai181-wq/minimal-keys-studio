import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonitorKeymapProvider } from "../keyboard/MonitorKeymapContext";
import { createMonitorStore } from "../monitor/monitorStore";
import { RightUsbEditorShell } from "./RightUsbEditorShell";

vi.mock("../trackball/TrackballPrecisionContext", () => ({
  useTrackballPrecision: () => ({ availability: "disconnected" }),
}));

describe("RightUsbEditorShell", () => {
  it("keeps the production header and active editor boundary stable for pointer frames", async () => {
    const store = createMonitorStore((notify) => { notify(); return () => {}; });
    const renders = { header: 0, editor: 0 };
    function Header() { renders.header += 1; return <header>production header</header>; }
    function ActiveEditor() { renders.editor += 1; return <main>production active editor</main>; }
    render(
      <MonitorKeymapProvider>
        <RightUsbEditorShell header={<Header />} editor={<ActiveEditor />} footer={<footer />} monitorStore={store} monitorActive editorAvailable connectionTitle="接続" connectionBody="接続中" />
      </MonitorKeymapProvider>,
    );
    renders.header = 0;
    renders.editor = 0;
    act(() => store.push({ kind: "pointer", dx: 4, dy: 0, wheel: 0, hwheel: 0, buttons: 0 }));
    await waitFor(() => expect(document.body).toHaveTextContent("dx +4"));
    expect(renders.header).toBe(0);
    expect(renders.editor).toBe(0);
  });
});
