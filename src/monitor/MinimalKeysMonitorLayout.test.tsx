import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MinimalKeysMonitorLayout } from "./MinimalKeysMonitorLayout";
import {
  getMonitorKeyLabel,
  MONITOR_KEY_LABELS_BY_LAYER,
} from "./minimalKeysMonitorLabels";

describe("MinimalKeysMonitorLayout", () => {
  it("renders the physical minimal-keys positions and highlights pressed keys", () => {
    render(
      <MinimalKeysMonitorLayout
        activeLayerIndex={0}
        pressed={new Set([40])}
      />,
    );

    expect(
      screen.getByRole("grid", { name: "minimal-keys 実配列モニター" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("gridcell")).toHaveLength(43);
    expect(screen.getByLabelText("pos 40 Enter / Shift 押下中")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("uses active layer labels and falls back to base labels for transparent keys", () => {
    expect(getMonitorKeyLabel(5, 6)).toEqual({
      label: "USB",
      transparent: false,
    });
    expect(getMonitorKeyLabel(0, 7)).toEqual({
      label: "Q",
      transparent: true,
    });
  });

  it("keeps every static monitor layer aligned to the 43 physical positions", () => {
    expect(MONITOR_KEY_LABELS_BY_LAYER.map((labels) => labels.length)).toEqual(
      Array.from({ length: 8 }, () => 43),
    );
  });
});
