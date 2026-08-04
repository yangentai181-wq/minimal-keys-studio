import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not change the displayed layer when selection is locked", () => {
    const onLayerClicked = vi.fn();
    const layers = Array.from({ length: 3 }, (_, index) => ({
      id: index,
      name: `Layer ${index}`,
    }));

    render(
      <LayerPicker
        layers={layers}
        selectedLayerIndex={0}
        onLayerClicked={onLayerClicked}
        selectionLocked
      />,
    );

    fireEvent.click(screen.getByText("Layer 2"));

    expect(onLayerClicked).not.toHaveBeenCalled();
  });

  it("hides the inactive auto mouse layer in monitor display", () => {
    const layers = Array.from({ length: 8 }, (_, index) => ({
      id: index,
      name: index === 4 ? "Mouse" : index === 7 ? "Scroll" : `Layer ${index}`,
    }));

    render(
      <LayerPicker
        layers={layers}
        selectedLayerIndex={0}
        showInactiveAutoMouseLayer={false}
      />,
    );

    expect(screen.queryByText("Auto Mouse")).toBeNull();
    expect(screen.queryByText("Mouse")).toBeNull();
  });

  it("shows the auto mouse layer when it is the active layer", () => {
    const layers = Array.from({ length: 8 }, (_, index) => ({
      id: index,
      name: index === 4 ? "Mouse" : index === 7 ? "Scroll" : `Layer ${index}`,
    }));

    render(
      <LayerPicker
        layers={layers}
        selectedLayerIndex={4}
        showInactiveAutoMouseLayer={false}
      />,
    );

    expect(screen.getByText("Auto Mouse")).toBeTruthy();
    expect(screen.getByText("Mouse")).toBeTruthy();
  });

  it("keeps the selected highlight on the original layer index when auto mouse is hidden", () => {
    const layers = Array.from({ length: 8 }, (_, index) => ({
      id: index,
      name: index === 4 ? "Mouse" : index === 7 ? "Scroll" : `Layer ${index}`,
    }));

    render(
      <LayerPicker
        layers={layers}
        selectedLayerIndex={5}
        showInactiveAutoMouseLayer={false}
      />,
    );

    expect(screen.getByText("Layer 5").closest("[role='option']")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("does not expose the internal precision layer for selection or editing", () => {
    const layers = Array.from({ length: 9 }, (_, index) => ({
      id: index === 8 ? 91 : index + 20,
      name: index === 8 ? "Precision" : `Layer ${index}`,
    }));

    render(<LayerPicker layers={layers} selectedLayerIndex={0} onLayerClicked={vi.fn()} />);

    expect(screen.queryByText("Precision")).toBeNull();
    expect(screen.queryByText("精密モード")).toBeNull();
  });
});
