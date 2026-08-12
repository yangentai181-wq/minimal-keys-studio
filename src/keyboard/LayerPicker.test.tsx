import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LayerPicker } from "./LayerPicker";

describe("LayerPicker minimal-keys layer badges", () => {
  it("marks fixed auto mouse and scroll layers after reordering", () => {
    const layers = [
      { id: 7, name: "Scroll" },
      { id: 0, name: "Base" },
      { id: 4, name: "Mouse" },
    ];

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
    const layers = [
      { id: 0, name: "Base" },
      { id: 4, name: "Mouse" },
      { id: 7, name: "Scroll" },
    ];

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
    const layers = [
      { id: 0, name: "Base" },
      { id: 4, name: "Mouse" },
      { id: 7, name: "Scroll" },
    ];

    render(
      <LayerPicker
        layers={layers}
      selectedLayerIndex={1}
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

  it("does not expose the internal precision layer ID for selection or editing", () => {
    const layers = [
      { id: 8, name: "Precision" },
      { id: 0, name: "Base" },
    ];

    render(<LayerPicker layers={layers} selectedLayerIndex={0} onLayerClicked={vi.fn()} />);

    expect(screen.queryByText("Precision")).toBeNull();
    expect(screen.queryByText("精密モード")).toBeNull();
  });

  it("disables add and remove controls when the reserved layer is present", () => {
    const layers = [{ id: 0, name: "Base" }, { id: 8, name: "Precision" }];
    const reason = "精密モード用レイヤーを保護するため、レイヤーの追加と削除はできません";

    render(<LayerPicker layers={layers} selectedLayerIndex={0} canAdd canRemove onAddClicked={vi.fn()} onRemoveClicked={vi.fn()} layerOperationsLockedMessage={reason} />);

    expect(screen.getAllByTitle(reason)).toHaveLength(2);
    expect(screen.getAllByTitle(reason)[0]).toBeDisabled();
    expect(screen.getAllByTitle(reason)[1]).toBeDisabled();
  });
});
