import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { useLayoutEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  DirtyStateProvider,
  useDirtyNavigation,
  useDirtyRegistration,
} from "./DirtyStateContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <DirtyStateProvider>{children}</DirtyStateProvider>;
}

function LatestRegistrationHarness({
  destination,
  staleSave,
  latestSave,
}: {
  destination: () => void;
  staleSave: () => Promise<boolean>;
  latestSave: () => Promise<boolean>;
}) {
  const [dirty, setDirty] = useState(false);
  const requested = useRef(false);
  const navigation = useDirtyNavigation();

  useDirtyRegistration("keymap", {
    dirty,
    save: dirty ? latestSave : staleSave,
    discard: vi.fn().mockResolvedValue(true),
  });

  useLayoutEffect(() => {
    if (dirty && !requested.current) {
      requested.current = true;
      void navigation.requestNavigation(destination);
    }
  }, [destination, dirty, navigation]);

  return (
    <button type="button" onClick={() => setDirty(true)}>
      編集する
    </button>
  );
}

function SnapshotConsumer({ onRestore }: { onRestore: (snapshot: unknown) => void }) {
  useDirtyRegistration("encoder", {
    dirty: true,
    save: vi.fn().mockResolvedValue(true),
    discard: vi.fn().mockResolvedValue(true),
    snapshot: () => 42,
    restore: onRestore,
  });

  return <p>エンコーダー画面</p>;
}

function SnapshotHarness({ onRestore }: { onRestore: (snapshot: unknown) => void }) {
  const { preserveDirtyDrafts } = useDirtyNavigation();
  const [mounted, setMounted] = useState(true);

  return (
    <>
      <button type="button" onClick={preserveDirtyDrafts}>
        スナップショットを保存
      </button>
      <button type="button" onClick={() => setMounted(false)}>
        画面を閉じる
      </button>
      <button type="button" onClick={() => setMounted(true)}>
        画面を開く
      </button>
      {mounted && <SnapshotConsumer onRestore={onRestore} />}
    </>
  );
}

describe("DirtyStateContext", () => {
  it("navigates immediately while every registered screen is clean", async () => {
    const { result } = renderHook(() => useDirtyNavigation(), { wrapper });

    await expect(result.current.requestNavigation(vi.fn())).resolves.toBe(true);
  });

  it("runs the save handler before completing dirty navigation", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => {
      useDirtyRegistration("keymap", { dirty: true, save, discard: vi.fn().mockResolvedValue(true) });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();

    const pending = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmSave());

    await expect(pending).resolves.toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(destination).toHaveBeenCalledOnce();
  });

  it("discards dirty edits before completing navigation", async () => {
    const discard = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => {
      useDirtyRegistration("keymap", { dirty: true, save: vi.fn().mockResolvedValue(true), discard });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();

    const pending = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmDiscard());

    await expect(pending).resolves.toBe(true);
    expect(discard).toHaveBeenCalledOnce();
    expect(destination).toHaveBeenCalledOnce();
  });

  it("keeps the current screen when navigation is cancelled or saving fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("failed"));
    const { result } = renderHook(() => {
      useDirtyRegistration("keymap", { dirty: true, save, discard: vi.fn().mockResolvedValue(true) });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();

    const cancelled = result.current.requestNavigation(destination);
    act(() => result.current.cancelNavigation());
    await expect(cancelled).resolves.toBe(false);

    const failed = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmSave());
    await expect(failed).resolves.toBe(false);
    expect(destination).not.toHaveBeenCalled();
  });

  it("keeps the draft mounted when a save reports failure", async () => {
    const { result } = renderHook(() => {
      useDirtyRegistration("trackball", { dirty: true, save: vi.fn().mockResolvedValue(false), discard: vi.fn().mockResolvedValue(true) });
      return useDirtyNavigation();
    }, { wrapper });
    const destination = vi.fn();
    const pending = result.current.requestNavigation(destination);
    await act(async () => result.current.confirmSave());
    await expect(pending).resolves.toBe(false);
    expect(destination).not.toHaveBeenCalled();
  });

  it("reads the latest registration without re-registering on each render", async () => {
    const destination = vi.fn();
    const staleSave = vi.fn().mockResolvedValue(true);
    const latestSave = vi.fn().mockResolvedValue(true);
    render(
      <DirtyStateProvider>
        <LatestRegistrationHarness
          destination={destination}
          staleSave={staleSave}
          latestSave={latestSave}
        />
      </DirtyStateProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "編集する" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(destination).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存して移動" }));

    await waitFor(() => expect(destination).toHaveBeenCalledOnce());
    expect(latestSave).toHaveBeenCalledOnce();
    expect(staleSave).not.toHaveBeenCalled();
  });

  it("consumes a preserved snapshot once", async () => {
    const restore = vi.fn();
    render(
      <DirtyStateProvider>
        <SnapshotHarness onRestore={restore} />
      </DirtyStateProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "スナップショットを保存" }));
    fireEvent.click(screen.getByRole("button", { name: "画面を閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "画面を開く" }));

    await waitFor(() => expect(restore).toHaveBeenCalledWith(42));
    expect(screen.getByText("未保存の変更を復元しました")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "画面を閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "画面を開く" }));
    await waitFor(() => expect(screen.getByText("エンコーダー画面")).toBeInTheDocument());
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
