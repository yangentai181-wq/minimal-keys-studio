import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackballPrecisionSettings } from "./TrackballPrecisionSettings";
import { useTrackballPrecision } from "./TrackballPrecisionContext";
import { useConnectedPrecisionSelection } from "./useConnectedPrecisionSelection";
import { useDirtyRegistration } from "../navigation/DirtyStateContext";

const updateDraft = vi.fn();
const save = vi.fn();
const reload = vi.fn();
const selection = (analysis: { supported: true; tapLabel: string; holdLabel: string } | { supported: false; reason: string } | null) => ({ keymap: undefined, behaviors: [], analysis });

vi.mock("./TrackballPrecisionContext", () => ({
  useTrackballPrecision: vi.fn(() => ({
    availability: "available",
    confirmed: {
      schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: false,
      selectedPosition: 0, originalBinding: null, revision: 1,
      precisionActive: false, currentCpi: 800,
    },
    draft: { normalCpi: 800, precisionCpi: 200, enabled: false, selectedPosition: 0 },
    dirty: false,
    saving: false,
    error: null,
    updateDraft,
    save,
    reload,
  })),
}));

vi.mock("./PrecisionKeyPicker", () => ({
  ConnectedPrecisionKeyPicker: () => <div data-testid="precision-key-picker" />,
}));

vi.mock("./useConnectedPrecisionSelection", () => ({
  useConnectedPrecisionSelection: vi.fn(() => selection({ supported: true, tapLabel: "A", holdLabel: "なし" })),
}));

vi.mock("../navigation/DirtyStateContext", () => ({
  useDirtyRegistration: vi.fn(),
}));

describe("TrackballPrecisionSettings", () => {
  it("shows the confirmed default CPI values with constrained controls", () => {
    render(<TrackballPrecisionSettings />);

    const normal = screen.getByLabelText("通常の速さ");
    const precision = screen.getByLabelText("精密モードの速さ");
    expect(normal).toHaveAttribute("min", "200");
    expect(normal).toHaveAttribute("max", "3200");
    expect(normal).toHaveAttribute("step", "200");
    expect(normal).toHaveValue("800");
    expect(precision).toHaveValue("200");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("edits only the draft and prevents saving precision CPI above normal CPI", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "available",
      confirmed: null,
      draft: { normalCpi: 800, precisionCpi: 1000, enabled: false, selectedPosition: 0 },
      dirty: true,
      saving: false,
      error: null,
      updateDraft,
      save,
      reload: vi.fn(),
    });
    render(<TrackballPrecisionSettings />);

    fireEvent.change(screen.getByLabelText("精密モードの速さ"), { target: { value: "1200" } });

    expect(updateDraft).toHaveBeenCalledWith({ precisionCpi: 1200 });
    expect(screen.getByText("精密 CPI は通常 CPI 以下にしてください")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("allows disabled drafts to save without key analysis", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "available", confirmed: null,
      draft: { normalCpi: 800, precisionCpi: 200, enabled: false, selectedPosition: 0 },
      dirty: true, saving: false, error: null, updateDraft, save, reload: vi.fn(),
    });
    vi.mocked(useConnectedPrecisionSelection).mockReturnValue(selection(null));
    render(<TrackballPrecisionSettings />);

    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    expect(useConnectedPrecisionSelection).not.toHaveBeenCalled();
  });

  it("blocks re-enabled saves until the same selected position has current supported analysis", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "available",
      confirmed: null,
      draft: { normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 0 },
      dirty: true,
      saving: false,
      error: null,
      updateDraft,
      save,
      reload: vi.fn(),
    });
    vi.mocked(useConnectedPrecisionSelection).mockReturnValue(selection(null));
    const view = render(<TrackballPrecisionSettings />);

    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    vi.mocked(useConnectedPrecisionSelection).mockReturnValue(selection({ supported: true, tapLabel: "A", holdLabel: "なし" }));
    // Re-render models the synchronous analysis returned after the latest selected key data arrives.
    view.rerender(<TrackballPrecisionSettings />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByTestId("precision-key-picker")).toBeInTheDocument();
  });

  it("shows the current unsupported key reason and blocks enabled saves", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "available", confirmed: null,
      draft: { normalCpi: 800, precisionCpi: 200, enabled: true, selectedPosition: 0 },
      dirty: true, saving: false, error: null, updateDraft, save, reload: vi.fn(),
    });
    vi.mocked(useConnectedPrecisionSelection).mockReturnValue(selection({ supported: false, reason: "このキーは選べません" }));
    render(<TrackballPrecisionSettings />);

    expect(screen.getByText("このキーは選べません")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("explains that a firmware update is required when unavailable", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "firmware-update-required",
      confirmed: null, draft: null, dirty: false, saving: false, error: null,
      updateDraft, save, reload: vi.fn(),
    });
    render(<TrackballPrecisionSettings />);

    expect(screen.getByText("ファームウェアの更新が必要です")).toBeVisible();
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });

  it.each([
    ["loading", "設定を読み込んでいます…"],
    ["disconnected", "キーボードに接続すると設定できます"],
    ["firmware-update-required", "ファームウェアの更新が必要です"],
    ["error", "設定の読み込みに失敗しました"],
  ] as const)("shows the truthful %s state", (availability, message) => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability,
      confirmed: availability === "disconnected" ? {
        schemaVersion: 1, normalCpi: 800, precisionCpi: 200, enabled: false,
        selectedPosition: 0, originalBinding: null, revision: 1, precisionActive: false, currentCpi: 800,
      } : null,
      draft: null, dirty: false, saving: false, error: null, updateDraft, save, reload,
    });
    render(<TrackballPrecisionSettings />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("retries a failed load", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "error", confirmed: null, draft: null, dirty: false, saving: false, error: null,
      updateDraft, save, reload,
    });
    render(<TrackballPrecisionSettings />);
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));

    expect(screen.getByRole("button", { name: "もう一度読み込む" })).toBeEnabled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps navigation on the editor when discarding a precision draft fails", async () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "available", confirmed: null,
      draft: { normalCpi: 1000, precisionCpi: 200, enabled: false, selectedPosition: 0 },
      dirty: true, saving: false, error: null, updateDraft, save, reload: vi.fn().mockResolvedValue(false),
    });
    render(<TrackballPrecisionSettings />);

    const registrations = vi.mocked(useDirtyRegistration).mock.calls
      .filter(([id]) => id === "trackball-precision");
    const registration = registrations[registrations.length - 1]?.[1];

    await expect(registration?.discard()).resolves.toBe(false);
  });
});
