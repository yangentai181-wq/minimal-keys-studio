import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LayerPicker } from "./LayerPicker";

describe("LayerPicker minimal-keys layer badges", () => {
  it("marks fixed auto mouse and scroll layers", () => {
    const layers = Array.from({ length: 8 }, (_, index) => ({
      id: index,
      name: index === 4 ? "Mouse" : index === 7 ? "Scroll" : `Layer ${index}`,
    }));

    render(
      <LayerPicker
        layers={layers}
        selectedLayerIndex={0}
        onLayerClicked={vi.fn()}
      />,
    );

    expect(screen.getByText("Auto Mouse")).toBeTruthy();
    expect(screen.getAllByText("Scroll").length).toBeGreaterThanOrEqual(2);
  });
});
