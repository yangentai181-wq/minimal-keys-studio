import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackballPrecisionSettings } from "./TrackballPrecisionSettings";
import { useTrackballPrecision } from "./TrackballPrecisionContext";

const updateDraft = vi.fn();
const save = vi.fn();

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
    reload: vi.fn(),
  })),
}));

vi.mock("./PrecisionKeyPicker", () => ({
  ConnectedPrecisionKeyPicker: () => <div data-testid="precision-key-picker" />,
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

  it("saves a valid dirty draft without sending key selection changes immediately", () => {
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
    render(<TrackballPrecisionSettings />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByTestId("precision-key-picker")).toBeInTheDocument();
  });

  it("explains that a firmware update is required when unavailable", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue({
      availability: "firmware-update-required",
      confirmed: null, draft: null, dirty: false, saving: false, error: null,
      updateDraft, save, reload: vi.fn(),
    });
    render(<TrackballPrecisionSettings />);

    expect(screen.getByText("ファームウェアの更新が必要です")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });
});
