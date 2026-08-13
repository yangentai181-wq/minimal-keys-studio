import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionContext } from "./ConnectionContext";
import { CustomSubsystemsProvider } from "./CustomSubsystemsProvider";
import { CustomSubsystemsContext } from "./CustomSubsystemsContext";
import { LockStateContext } from "./LockStateContext";

const callRpc = vi.fn();

vi.mock("@zmkfirmware/zmk-studio-ts-client/core", () => ({
  LockState: { ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED: 2 },
}));
vi.mock("@zmkfirmware/zmk-studio-ts-client/index", () => ({}));
vi.mock("./logging", () => ({ call_rpc: (...args: unknown[]) => callRpc(...args) }));

function Consumer() {
  const value = useContext(CustomSubsystemsContext);
  return <>
    <output data-testid="status">{value.status}</output>
    <output data-testid="subsystems">{value.subsystems.map((subsystem) => subsystem.identifier).join(",")}</output>
    <button onClick={value.retry}>retry</button>
  </>;
}

function renderProvider(conn: object | null, lockState = LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
  return render(
    <ConnectionContext.Provider value={{ conn: conn as never }}>
      <LockStateContext.Provider value={lockState}>
        <CustomSubsystemsProvider><Consumer /></CustomSubsystemsProvider>
      </LockStateContext.Provider>
    </ConnectionContext.Provider>,
  );
}

function response(subsystems: { identifier: string; index: number }[]) {
  return { custom: { listCustomSubsystems: { subsystems } } };
}

afterEach(() => vi.clearAllMocks());

describe("CustomSubsystemsProvider", () => {
  it("reports disconnected until an unlocked connection is available", () => {
    renderProvider(null);
    expect(screen.getByTestId("status")).toHaveTextContent("disconnected");
  });

  it("reports loading before discovery completes", () => {
    callRpc.mockImplementation(() => new Promise(() => {}));
    renderProvider({});
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
  });

  it("reports ready with an empty capability list", async () => {
    callRpc.mockResolvedValue(response([]));
    renderProvider({});
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("subsystems")).toHaveTextContent("");
  });

  it("reports ready with discovered capabilities", async () => {
    callRpc.mockResolvedValue(response([{ identifier: "trackball_precision", index: 4 }]));
    renderProvider({});
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("subsystems")).toHaveTextContent("trackball_precision");
  });

  it("reports discovery errors and retries on request", async () => {
    callRpc.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response([]));
    renderProvider({});
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    await act(async () => screen.getByRole("button", { name: "retry" }).click());
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(callRpc).toHaveBeenCalledTimes(2);
  });

  it("ignores an old discovery response after a new connection generation", async () => {
    let resolveOld: (value: ReturnType<typeof response>) => void;
    callRpc.mockImplementationOnce(() => new Promise<ReturnType<typeof response>>((resolve) => { resolveOld = resolve; }));
    const view = renderProvider({ id: "old" });
    callRpc.mockResolvedValueOnce(response([{ identifier: "new", index: 2 }]));
    view.rerender(
      <ConnectionContext.Provider value={{ conn: { id: "new" } as never }}>
        <LockStateContext.Provider value={LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED}>
          <CustomSubsystemsProvider><Consumer /></CustomSubsystemsProvider>
        </LockStateContext.Provider>
      </ConnectionContext.Provider>,
    );
    await waitFor(() => expect(screen.getByTestId("subsystems")).toHaveTextContent("new"));
    await act(async () => resolveOld!(response([{ identifier: "old", index: 1 }])));
    expect(screen.getByTestId("subsystems")).toHaveTextContent("new");
  });
});
