import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackballPrecisionStatus } from "./TrackballPrecisionStatus";
import { useTrackballPrecision } from "../trackball/TrackballPrecisionContext";

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

const contextValue = (overrides = {}) => ({
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

vi.mock("../trackball/TrackballPrecisionContext", () => ({
  useTrackballPrecision: vi.fn(),
}));

describe("TrackballPrecisionStatus", () => {
  it("shows the confirmed normal, precision, and current CPI in normal mode", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue());

    render(<TrackballPrecisionStatus />);

    const status = screen.getByRole("region", { name: "トラックボール精密モード" });
    expect(status).toHaveTextContent("通常");
    expect(screen.getByText("通常 CPI")).toBeVisible();
    expect(within(screen.getByText("通常 CPI").parentElement!).getByText("800")).toBeVisible();
    expect(screen.getByText("精密 CPI")).toBeVisible();
    expect(within(screen.getByText("精密 CPI").parentElement!).getByText("200")).toBeVisible();
    expect(screen.getByText("現在の CPI")).toBeVisible();
  });

  it("keeps showing confirmed values when only the draft changes", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue());
    const view = render(<TrackballPrecisionStatus />);

    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue({
      draft: { normalCpi: 1200, precisionCpi: 400, enabled: true, selectedPosition: 5 },
      dirty: true,
    }));
    view.rerender(<TrackballPrecisionStatus />);

    const status = screen.getByRole("region", { name: "トラックボール精密モード" });
    expect(status).toHaveTextContent("通常");
    expect(within(screen.getByText("通常 CPI").parentElement!).getByText("800")).toBeVisible();
    expect(within(screen.getByText("精密 CPI").parentElement!).getByText("200")).toBeVisible();
    expect(screen.queryByText("1200")).not.toBeInTheDocument();
    expect(screen.queryByText("400")).not.toBeInTheDocument();
  });

  it("updates immediately when the confirmed device notification enters precision mode", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue());
    const view = render(<TrackballPrecisionStatus />);

    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue({
      confirmed: { ...confirmed, precisionActive: true, currentCpi: 200 },
    }));
    view.rerender(<TrackballPrecisionStatus />);

    const status = screen.getByRole("region", { name: "トラックボール精密モード" });
    expect(status).toHaveTextContent("精密");
    expect(within(screen.getByText("現在の CPI").parentElement!).getByText("200")).toBeVisible();
  });

  it.each([
    "loading",
    "firmware-update-required",
  ] as const)("hides the card while the subsystem is %s", (availability) => {
    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue({ availability }));

    render(<TrackballPrecisionStatus />);

    expect(screen.queryByRole("region", { name: "トラックボール精密モード" })).not.toBeInTheDocument();
  });

  it("hides the card without confirmed device state", () => {
    vi.mocked(useTrackballPrecision).mockReturnValue(contextValue({ confirmed: null }));

    render(<TrackballPrecisionStatus />);

    expect(screen.queryByRole("region", { name: "トラックボール精密モード" })).not.toBeInTheDocument();
  });
});
