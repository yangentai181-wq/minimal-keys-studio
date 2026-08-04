import { act, render, screen, waitFor } from "@testing-library/react";
import { Writer } from "protobufjs/minimal";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplyResult, encodeApply, encodeGet, type TrackballConfig } from "../proto/trackball-settings";

let subsystem: { subsystemIndex: number; callRPC: ReturnType<typeof vi.fn> } | null = null;
let notificationHandler: ((payload: Uint8Array) => void) | undefined;

vi.mock("../rpc/useCustomSubsystem", () => ({
  useCustomSubsystem: () => subsystem,
  useCustomNotification: (_index: number | undefined, handler: (payload: Uint8Array) => void) => {
    notificationHandler = handler;
  },
}));

import {
  TrackballPrecisionProvider,
  useTrackballPrecision,
} from "./TrackballPrecisionContext";

const initialConfig: TrackballConfig = {
  schemaVersion: 1,
  normalCpi: 800,
  precisionCpi: 200,
  enabled: true,
  selectedPosition: 5,
  originalBinding: null,
  revision: 7,
  precisionActive: false,
  currentCpi: 800,
};

function encodeConfig(config: TrackballConfig): Uint8Array {
  const writer = Writer.create();
  writer.uint32(8).uint32(config.schemaVersion);
  writer.uint32(16).uint32(config.normalCpi);
  writer.uint32(24).uint32(config.precisionCpi);
  writer.uint32(32).bool(config.enabled);
  writer.uint32(40).uint32(config.selectedPosition);
  writer.uint32(56).uint32(config.revision);
  writer.uint32(64).bool(config.precisionActive);
  writer.uint32(72).uint32(config.currentCpi);
  return writer.finish();
}

function getResponse(config: TrackballConfig): Uint8Array {
  return Writer.create().uint32(10).bytes(encodeConfig(config)).finish();
}

function applyResponse(result: ApplyResult, config: TrackballConfig | null): Uint8Array {
  const response = Writer.create().uint32(8).int32(result);
  if (config) response.uint32(18).bytes(encodeConfig(config));
  return Writer.create().uint32(26).bytes(response.finish()).finish();
}

function notification(config: TrackballConfig): Uint8Array {
  return Writer.create().uint32(10).bytes(encodeConfig(config)).finish();
}

function Consumer() {
  const value = useTrackballPrecision();
  return (
    <>
      <output data-testid="availability">{value.availability}</output>
      <output data-testid="confirmed">{value.confirmed?.normalCpi ?? "none"}</output>
      <output data-testid="draft">{value.draft?.normalCpi ?? "none"}</output>
      <output data-testid="dirty">{String(value.dirty)}</output>
      <output data-testid="saving">{String(value.saving)}</output>
      <output data-testid="error">{value.error ?? "none"}</output>
      <button onClick={() => value.updateDraft({ normalCpi: 1000 })}>edit</button>
      <button onClick={() => void value.save()}>save</button>
      <button onClick={() => void value.reload()}>reload</button>
    </>
  );
}

function renderProvider() {
  return render(
    <TrackballPrecisionProvider>
      <Consumer />
      <div data-testid="runtime-editor">runtime editor</div>
    </TrackballPrecisionProvider>,
  );
}

async function discover(config = initialConfig) {
  subsystem = { subsystemIndex: 4, callRPC: vi.fn().mockResolvedValue(getResponse(config)) };
  renderProvider();
  await waitFor(() => expect(screen.getByTestId("availability")).toHaveTextContent("available"));
}

afterEach(() => {
  subsystem = null;
  notificationHandler = undefined;
  vi.useRealTimers();
});

describe("TrackballPrecisionProvider", () => {
  it("reads the device configuration when the custom subsystem is discovered", async () => {
    await discover();

    expect(subsystem?.callRPC).toHaveBeenCalledWith(encodeGet());
    expect(screen.getByTestId("confirmed")).toHaveTextContent("800");
    expect(screen.getByTestId("draft")).toHaveTextContent("800");
  });

  it("keeps edits in the draft without changing confirmed device state", async () => {
    await discover();

    await act(async () => screen.getByText("edit").click());

    expect(screen.getByTestId("confirmed")).toHaveTextContent("800");
    expect(screen.getByTestId("draft")).toHaveTextContent("1000");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
  });

  it("sends the confirmed revision and remains pending until a matching notification", async () => {
    await discover();
    subsystem?.callRPC.mockResolvedValueOnce(applyResponse(ApplyResult.OK, { ...initialConfig, revision: 8, normalCpi: 1200 }));
    subsystem?.callRPC.mockResolvedValueOnce(getResponse({ ...initialConfig, revision: 8, normalCpi: 1200 }));
    await act(async () => screen.getByText("edit").click());

    await act(async () => screen.getByText("save").click());

    await waitFor(() => expect(subsystem?.callRPC).toHaveBeenCalledWith(encodeApply({ ...initialConfig, normalCpi: 1000 }, 7)));
    expect(screen.getByTestId("saving")).toHaveTextContent("true");
    expect(subsystem?.callRPC).toHaveBeenCalledWith(encodeGet());

    await act(async () => notificationHandler?.(notification({ ...initialConfig, revision: 8, normalCpi: 1000 })));

    expect(screen.getByTestId("saving")).toHaveTextContent("false");
    expect(screen.getByTestId("confirmed")).toHaveTextContent("1000");
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
  });

  it("restores the confirmed UI and records an unsaved error after a five-second timeout", async () => {
    vi.useFakeTimers();
    subsystem = { subsystemIndex: 4, callRPC: vi.fn().mockResolvedValue(getResponse(initialConfig)) };
    renderProvider();
    await act(async () => {});
    subsystem?.callRPC.mockImplementationOnce(() => new Promise<Uint8Array>(() => {}));
    await act(async () => screen.getByText("edit").click());
    await act(async () => screen.getByText("save").click());

    await act(async () => vi.advanceTimersByTimeAsync(5000));

    expect(screen.getByTestId("saving")).toHaveTextContent("false");
    expect(screen.getByTestId("confirmed")).toHaveTextContent("800");
    expect(screen.getByTestId("draft")).toHaveTextContent("1000");
    expect(screen.getByTestId("error")).not.toHaveTextContent("none");
  });

  it("reports a transport failure without replacing confirmed state", async () => {
    await discover();
    subsystem?.callRPC.mockRejectedValueOnce(new Error("transport lost"));
    await act(async () => screen.getByText("edit").click());
    await act(async () => screen.getByText("save").click());

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("transport lost"));
    expect(screen.getByTestId("confirmed")).toHaveTextContent("800");
    expect(screen.getByTestId("draft")).toHaveTextContent("1000");
  });

  it("reloads after a stale response and does not overwrite the device state", async () => {
    await discover();
    subsystem?.callRPC.mockResolvedValueOnce(applyResponse(ApplyResult.STALE_REVISION, { ...initialConfig, revision: 8, normalCpi: 1200 }));
    subsystem?.callRPC.mockResolvedValueOnce(getResponse({ ...initialConfig, revision: 9, normalCpi: 1400 }));
    await act(async () => screen.getByText("edit").click());
    await act(async () => screen.getByText("save").click());

    await waitFor(() => expect(subsystem?.callRPC).toHaveBeenCalledWith(encodeGet()));
    await waitFor(() => expect(screen.getByTestId("confirmed")).toHaveTextContent("1400"));
    expect(screen.getByTestId("draft")).toHaveTextContent("1400");
    expect(screen.getByTestId("dirty")).toHaveTextContent("false");
  });

  it("drops browser-only drafts on disconnect and refetches on reconnect", async () => {
    subsystem = { subsystemIndex: 4, callRPC: vi.fn().mockResolvedValue(getResponse(initialConfig)) };
    const view = renderProvider();
    await waitFor(() => expect(screen.getByTestId("availability")).toHaveTextContent("available"));
    await act(async () => screen.getByText("edit").click());
    subsystem = null;
    view.rerender(
      <TrackballPrecisionProvider><Consumer /></TrackballPrecisionProvider>,
    );
    expect(screen.getByTestId("availability")).toHaveTextContent("firmware-update-required");
    expect(screen.getByTestId("draft")).toHaveTextContent("none");

    subsystem = { subsystemIndex: 4, callRPC: vi.fn().mockResolvedValue(getResponse({ ...initialConfig, revision: 8, normalCpi: 1200 })) };
    view.rerender(
      <TrackballPrecisionProvider><Consumer /></TrackballPrecisionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("confirmed")).toHaveTextContent("1200"));
    expect(screen.getByTestId("draft")).toHaveTextContent("1200");
  });

  it("ignores an in-flight save from a disconnected subsystem after reconnect", async () => {
    let resolveOldApply: ((value: Uint8Array) => void) | undefined;
    const oldSubsystem = {
      subsystemIndex: 4,
      callRPC: vi.fn()
        .mockResolvedValueOnce(getResponse(initialConfig))
        .mockImplementationOnce(() => new Promise<Uint8Array>((resolve) => { resolveOldApply = resolve; })),
    };
    subsystem = oldSubsystem;
    const view = renderProvider();
    await waitFor(() => expect(screen.getByTestId("availability")).toHaveTextContent("available"));
    await act(async () => screen.getByText("edit").click());
    await act(async () => screen.getByText("save").click());
    expect(screen.getByTestId("saving")).toHaveTextContent("true");

    subsystem = null;
    view.rerender(<TrackballPrecisionProvider><Consumer /></TrackballPrecisionProvider>);
    subsystem = { subsystemIndex: 5, callRPC: vi.fn().mockResolvedValue(getResponse({ ...initialConfig, revision: 9, normalCpi: 1400 })) };
    view.rerender(<TrackballPrecisionProvider><Consumer /></TrackballPrecisionProvider>);
    await waitFor(() => expect(screen.getByTestId("confirmed")).toHaveTextContent("1400"));

    await act(async () => resolveOldApply?.(applyResponse(ApplyResult.OK, { ...initialConfig, revision: 8, normalCpi: 1200 })));

    expect(screen.getByTestId("confirmed")).toHaveTextContent("1400");
    expect(screen.getByTestId("draft")).toHaveTextContent("1400");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("saving")).toHaveTextContent("false");
    expect(oldSubsystem.callRPC).toHaveBeenCalledTimes(2);
  });

  it("reports legacy firmware as unavailable while leaving the runtime editor mounted", () => {
    renderProvider();

    expect(screen.getByTestId("availability")).toHaveTextContent("firmware-update-required");
    expect(screen.getByTestId("runtime-editor")).toBeInTheDocument();
  });
});
