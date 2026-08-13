import { cleanup, render, screen } from "@testing-library/react";
import type { Keymap } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { afterEach, describe, expect, it } from "vitest";

import {
  MonitorKeymapProvider,
  useMonitorKeymap,
  usePublishMonitorKeymap,
} from "./MonitorKeymapContext";

function keymapWithLayerName(name: string): Keymap {
  return {
    layers: [{ id: 0, name, bindings: [] }],
    availableLayers: 0,
    maxLayerNameLength: 16,
  };
}

function PublishedKeymap() {
  const keymap = useMonitorKeymap();
  return <output data-testid="published-keymap">{keymap?.layers[0]?.name ?? "undefined"}</output>;
}

function KeymapPublisher({ keymap }: { keymap: Keymap | undefined }) {
  usePublishMonitorKeymap(keymap);
  return null;
}

afterEach(() => cleanup());

describe("MonitorKeymapProvider", () => {
  it("starts with no published keymap", () => {
    render(
      <MonitorKeymapProvider>
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    expect(screen.getByTestId("published-keymap")).toHaveTextContent("undefined");
  });

  it("publishes the editor keymap", () => {
    render(
      <MonitorKeymapProvider>
        <KeymapPublisher keymap={keymapWithLayerName("Base")} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    expect(screen.getByTestId("published-keymap")).toHaveTextContent("Base");
  });

  it("replaces the published keymap after an editor edit", () => {
    const view = render(
      <MonitorKeymapProvider>
        <KeymapPublisher keymap={keymapWithLayerName("Before edit")} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    view.rerender(
      <MonitorKeymapProvider>
        <KeymapPublisher keymap={keymapWithLayerName("After edit")} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    expect(screen.getByTestId("published-keymap")).toHaveTextContent("After edit");
  });

  it("retains the last keymap after its current publisher unmounts", () => {
    const liveKeymap = keymapWithLayerName("Still live");
    const view = render(
      <MonitorKeymapProvider>
        <KeymapPublisher keymap={liveKeymap} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    view.rerender(
      <MonitorKeymapProvider>
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    expect(screen.getByTestId("published-keymap")).toHaveTextContent(
      "Still live",
    );
  });

  it("retains the last keymap while a replacement publisher is loading", () => {
    const liveKeymap = keymapWithLayerName("Still live");
    const view = render(
      <MonitorKeymapProvider>
        <KeymapPublisher keymap={liveKeymap} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    view.rerender(
      <MonitorKeymapProvider>
        <KeymapPublisher keymap={undefined} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    expect(screen.getByTestId("published-keymap")).toHaveTextContent(
      "Still live",
    );
  });

  it("does not clear a newer keymap when an earlier publisher unmounts", () => {
    const firstKeymap = keymapWithLayerName("Earlier");
    const secondKeymap = keymapWithLayerName("Newer");
    const view = render(
      <MonitorKeymapProvider>
        <KeymapPublisher key="first" keymap={firstKeymap} />
        <KeymapPublisher key="second" keymap={secondKeymap} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    view.rerender(
      <MonitorKeymapProvider>
        <KeymapPublisher key="second" keymap={secondKeymap} />
        <PublishedKeymap />
      </MonitorKeymapProvider>,
    );

    expect(screen.getByTestId("published-keymap")).toHaveTextContent("Newer");
  });
});
