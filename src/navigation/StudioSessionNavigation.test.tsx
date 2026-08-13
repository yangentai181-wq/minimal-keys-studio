import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  DirtyStateProvider,
  useDirtyRegistration,
  type DirtyRegistration,
} from "./DirtyStateContext";
import {
  type StudioTabId,
  useStudioSessionNavigation,
} from "./StudioSessionNavigation";
import { StudioTabView } from "./StudioTabView";

type ScreenConfig = Partial<DirtyRegistration> & {
  cleanup?: (id: StudioTabId) => void;
  mount?: (id: StudioTabId) => void;
};

interface InstrumentedScreenProps {
  id: StudioTabId;
  config?: ScreenConfig;
}

function InstrumentedScreen({ id, config }: InstrumentedScreenProps) {
  const [draft, setDraft] = useState(0);
  const save = config?.save ?? vi.fn().mockResolvedValue(true);
  const discard = config?.discard ?? vi.fn().mockResolvedValue(true);

  useDirtyRegistration(id, {
    dirty: config?.dirty ?? false,
    save,
    discard,
    snapshot: config?.snapshot ?? (() => draft),
    restore: config?.restore ?? ((snapshot) => setDraft(Number(snapshot))),
  });

  useEffect(() => {
    config?.mount?.(id);
    return () => config?.cleanup?.(id);
  }, [config, id]);

  return (
    <section aria-label={`${id} screen`}>
      {id} screen
      {id === "encoder" && <span data-testid="encoder-draft">draft:{draft}</span>}
    </section>
  );
}

interface SessionHarnessProps {
  initialTab?: StudioTabId;
  keymap?: ScreenConfig;
  encoder?: ScreenConfig;
  onClose?: () => void;
  onUnexpectedDisconnect?: () => void;
  renderCounts?: Partial<Record<StudioTabId, number>>;
}

function SessionHarness({
  initialTab,
  keymap,
  encoder,
  onClose,
  onUnexpectedDisconnect,
  renderCounts,
}: SessionHarnessProps) {
  const session = useStudioSessionNavigation({ initialTab });
  const [connected, setConnected] = useState(true);

  const renderTab = (tab: StudioTabId) => {
    renderCounts![tab] = (renderCounts![tab] ?? 0) + 1;
    return (
      <InstrumentedScreen
        id={tab}
        config={tab === "keymap" ? keymap : tab === "encoder" ? encoder : undefined}
      />
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void session.requestExplicitDisconnect(async () => {
            onClose?.();
            setConnected(false);
          });
        }}
      >
        テスト切断
      </button>
      <button
        type="button"
        onClick={() => {
          void session.handleUnexpectedDisconnect(async () => {
            onUnexpectedDisconnect?.();
            setConnected(false);
          });
        }}
      >
        予期しない切断
      </button>
      <button type="button" onClick={() => setConnected(true)}>
        再接続
      </button>
      {connected ? (
        <StudioTabView
          activeTab={session.activeTab}
          onSelectTab={(tab) => {
            void session.requestTab(tab);
          }}
          renderTab={renderTab}
        />
      ) : (
        <p>接続なし</p>
      )}
    </>
  );
}

function renderSession(props: SessionHarnessProps = {}) {
  return render(
    <DirtyStateProvider>
      <SessionHarness {...props} renderCounts={props.renderCounts ?? {}} />
    </DirtyStateProvider>,
  );
}

describe("Studio session navigation", () => {
  it("unmounts the previous clean tab and mounts only the selected tab", async () => {
    const cleanup = vi.fn();
    const renderCounts: Partial<Record<StudioTabId, number>> = {};
    renderSession({ keymap: { cleanup }, encoder: { cleanup }, renderCounts });

    expect(screen.getByRole("region", { name: "keymap screen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "エンコーダー" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "keymap screen" })).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "encoder screen" })).toBeInTheDocument();
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledWith("keymap");
    expect(renderCounts.holdtap ?? 0).toBe(0);
    expect(renderCounts.trackball ?? 0).toBe(0);
  });

  it("keeps the dirty tab mounted until save succeeds, then navigates", async () => {
    const order: string[] = [];
    const save = vi.fn(async () => {
      order.push("save");
      return true;
    });
    renderSession({
      keymap: {
        dirty: true,
        save,
        discard: vi.fn().mockResolvedValue(true),
        cleanup: () => order.push("cleanup"),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "エンコーダー" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "keymap screen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存して移動" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "encoder screen" })).toBeInTheDocument());
    expect(save).toHaveBeenCalledOnce();
    expect(order).toEqual(["save", "cleanup"]);
  });

  it("discards and navigates only after discard succeeds", async () => {
    const order: string[] = [];
    const discard = vi.fn(async () => {
      order.push("discard");
      return true;
    });
    renderSession({
      keymap: {
        dirty: true,
        save: vi.fn().mockResolvedValue(true),
        discard,
        cleanup: () => order.push("cleanup"),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "エンコーダー" }));
    fireEvent.click(screen.getByRole("button", { name: "破棄して移動" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "encoder screen" })).toBeInTheDocument());
    expect(discard).toHaveBeenCalledOnce();
    expect(order).toEqual(["discard", "cleanup"]);
  });

  it("cancel keeps the current dirty screen mounted", async () => {
    const cleanup = vi.fn();
    renderSession({
      keymap: {
        dirty: true,
        save: vi.fn().mockResolvedValue(true),
        discard: vi.fn().mockResolvedValue(true),
        cleanup,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "エンコーダー" }));
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "keymap screen" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "encoder screen" })).not.toBeInTheDocument();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it.each([
    ["returns false", () => Promise.resolve(false)],
    ["rejects", () => Promise.reject(new Error("save failed"))],
  ])("%s save keeps the current dirty screen mounted", async (_case, save) => {
    const cleanup = vi.fn();
    renderSession({
      keymap: {
        dirty: true,
        save: vi.fn(save),
        discard: vi.fn().mockResolvedValue(true),
        cleanup,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "エンコーダー" }));
    fireEvent.click(screen.getByRole("button", { name: "保存して移動" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "keymap screen" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "encoder screen" })).not.toBeInTheDocument();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it.each([
    ["保存して移動", "save", true],
    ["破棄して移動", "discard", true],
    ["戻る", "cancel", false],
  ] as const)("guards explicit disconnect with %s", async (buttonName, decision, shouldClose) => {
    const close = vi.fn();
    const save = vi.fn().mockResolvedValue(true);
    const discard = vi.fn().mockResolvedValue(true);
    renderSession({ keymap: { dirty: true, save, discard }, onClose: close });

    fireEvent.click(screen.getByRole("button", { name: "テスト切断" }));
    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    if (shouldClose) {
      await waitFor(() => expect(screen.getByText("接続なし")).toBeInTheDocument());
      expect(close).toHaveBeenCalledOnce();
      expect(decision === "save" ? save : discard).toHaveBeenCalledOnce();
    } else {
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(close).not.toHaveBeenCalled();
      expect(screen.getByRole("region", { name: "keymap screen" })).toBeInTheDocument();
    }
  });

  it("failed explicit-disconnect save does not close the connection", async () => {
    const close = vi.fn();
    renderSession({
      keymap: {
        dirty: true,
        save: vi.fn().mockResolvedValue(false),
        discard: vi.fn().mockResolvedValue(true),
      },
      onClose: close,
    });

    fireEvent.click(screen.getByRole("button", { name: "テスト切断" }));
    fireEvent.click(screen.getByRole("button", { name: "保存して移動" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "keymap screen" })).toBeInTheDocument();
  });

  it("snapshots before unexpected loss and restores the same tab after reconnect", async () => {
    const order: string[] = [];
    renderSession({
      initialTab: "encoder",
      encoder: {
        dirty: true,
        save: vi.fn().mockResolvedValue(true),
        discard: vi.fn().mockResolvedValue(true),
        snapshot: () => {
          order.push("snapshot");
          return 42;
        },
        cleanup: () => order.push("cleanup"),
      },
      onUnexpectedDisconnect: () => order.push("disconnect"),
    });

    expect(screen.getByRole("region", { name: "encoder screen" })).toHaveTextContent("draft:0");
    fireEvent.click(screen.getByRole("button", { name: "予期しない切断" }));

    await waitFor(() => expect(screen.getByText("接続なし")).toBeInTheDocument());
    expect(order).toEqual(["snapshot", "disconnect", "cleanup"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再接続" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "encoder screen" })).toHaveTextContent("draft:42"));
    expect(screen.queryByRole("region", { name: "keymap screen" })).not.toBeInTheDocument();
    expect(screen.getByText("未保存の変更を復元しました")).toBeInTheDocument();
  });

  it("does not treat an explicit aborted stream as unexpected", async () => {
    const snapshot = vi.fn(() => 42);
    const close = vi.fn();
    renderSession({
      initialTab: "encoder",
      encoder: {
        dirty: true,
        save: vi.fn().mockResolvedValue(true),
        discard: vi.fn().mockResolvedValue(true),
        snapshot,
      },
      onClose: close,
    });

    fireEvent.click(screen.getByRole("button", { name: "テスト切断" }));
    fireEvent.click(screen.getByRole("button", { name: "保存して移動" }));

    await waitFor(() => expect(screen.getByText("接続なし")).toBeInTheDocument());
    expect(close).toHaveBeenCalledOnce();
    expect(snapshot).not.toHaveBeenCalled();
  });
});
