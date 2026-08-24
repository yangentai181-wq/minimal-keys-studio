import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayersTab } from "./LayersTab";

const mockBehaviors = [
  { id: 10, displayName: "Momentary Layer", metadata: [] },
  { id: 11, displayName: "Toggle Layer", metadata: [] },
  { id: 12, displayName: "Layer-Tap", metadata: [] },
  { id: 13, displayName: "Sticky Layer", metadata: [] },
  { id: 14, displayName: "To Layer", metadata: [] },
  { id: 15, displayName: "LAYER_TAP_MKP", metadata: [] },
  { id: 1, displayName: "Key Press", metadata: [] },
];

const layers = [
  { id: 0, index: 0, name: "Base" },
  { id: 1, index: 1, name: "Symbols" },
  { id: 2, index: 2, name: "Nav" },
];

describe("LayersTab", () => {
  it("renders layer behavior options", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    expect(screen.getByText("一時レイヤー")).toBeTruthy();
    expect(screen.getByText("レイヤー切替")).toBeTruthy();
    expect(screen.getByText("レイヤー / タップ")).toBeTruthy();
  });

  it("shows layer selection after behavior click", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("一時レイヤー"));
    expect(screen.getByText("Base")).toBeTruthy();
    expect(screen.getByText("Symbols")).toBeTruthy();
    expect(screen.getByText("Nav")).toBeTruthy();
  });

  it("Momentary Layer: apply immediately on layer click", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("一時レイヤー"));
    fireEvent.click(screen.getByText("Symbols"));
    expect(onApply).toHaveBeenCalledWith({
      behaviorId: 10,
      param1: 1,
      param2: 0,
    });
  });

  it("Momentary Layer: writes the selected persistent layer ID", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={[
          { id: 42, index: 0, name: "Symbols" },
          { id: 0, index: 1, name: "Base" },
        ]}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("一時レイヤー"));
    fireEvent.click(screen.getByText("Symbols"));

    expect(onApply).toHaveBeenCalledWith({
      behaviorId: 10,
      param1: 42,
      param2: 0,
    });
  });

  it("Layer-Tap: shows apply button disabled initially", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("レイヤー / タップ"));
    const applyBtn = screen.getByText("適用する");
    expect(applyBtn).toHaveAttribute("disabled");
    fireEvent.click(screen.getByText("Symbols"));
    expect(
      screen.getByRole("combobox", { name: "タップキーを選択" }),
    ).toBeTruthy();
  });

  it("Layer-Tap: apply button enabled after both params", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("レイヤー / タップ"));
    fireEvent.click(screen.getByText("Symbols"));
    fireEvent.change(
      screen.getByRole("combobox", { name: "タップキーを選択" }),
      { target: { value: "0" } },
    );
    const applyBtn = screen.getByText("適用する");
    expect(applyBtn).not.toHaveAttribute("disabled");
  });

  it("Layer-Tap: apply sends correct binding", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("レイヤー / タップ"));
    fireEvent.click(screen.getByText("Symbols"));
    fireEvent.change(
      screen.getByRole("combobox", { name: "タップキーを選択" }),
      { target: { value: "0" } },
    );
    fireEvent.click(screen.getByText("適用する"));
    expect(onApply).toHaveBeenCalledWith({
      behaviorId: 12,
      param1: 1,
      param2: (7 << 16) + 44, // KB page 7, Space = 44
    });
  });

  it("LAYER_TAP_MKP: applies selected layer plus mouse button", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("レイヤー / マウスクリック"));
    fireEvent.click(screen.getByText("Symbols"));
    fireEvent.click(screen.getByText("左クリック"));
    fireEvent.click(screen.getByText("適用する"));
    expect(onApply).toHaveBeenCalledWith({
      behaviorId: 15,
      param1: 1,
      param2: 0x01,
    });
  });

  describe("layer role labels", () => {
    const layersWithRoles = [
      { id: 0, index: 0, name: "Base" },
      { id: 4, index: 4, name: "AutoMouse" },
      { id: 7, index: 7, name: "Scroll" },
    ];

    it("shows （スクロール） suffix for scroll layer (index 7)", () => {
      const onApply = vi.fn();
      render(
        <LayersTab
          behaviors={mockBehaviors}
          layers={layersWithRoles}
          onApplyBinding={onApply}
        />,
      );
      fireEvent.click(screen.getByText("一時レイヤー"));
      expect(screen.getByText("Scroll（スクロール）")).toBeTruthy();
    });

    it("shows （自動マウス） suffix for auto mouse layer (index 4)", () => {
      const onApply = vi.fn();
      render(
        <LayersTab
          behaviors={mockBehaviors}
          layers={layersWithRoles}
          onApplyBinding={onApply}
        />,
      );
      fireEvent.click(screen.getByText("一時レイヤー"));
      expect(screen.getByText("AutoMouse（自動マウス）")).toBeTruthy();
    });

    it("shows no role suffix for plain layer (index 0)", () => {
      const onApply = vi.fn();
      render(
        <LayersTab
          behaviors={mockBehaviors}
          layers={layersWithRoles}
          onApplyBinding={onApply}
        />,
      );
      fireEvent.click(screen.getByText("一時レイヤー"));
      expect(screen.getByText("Base")).toBeTruthy();
    });
  });

  it("omits the internal precision layer by array index for every layer behavior", () => {
    const onApply = vi.fn();
    const layersWithInternal = Array.from({ length: 9 }, (_, index) => ({
      id: index === 8 ? 91 : index + 20,
      index,
      name: index === 8 ? "Precision" : `Layer ${index}`,
    }));
    render(<LayersTab behaviors={mockBehaviors} layers={layersWithInternal} onApplyBinding={onApply} />);

    fireEvent.click(screen.getByText("レイヤー切替"));

    expect(screen.queryByText("Precision")).toBeNull();
    fireEvent.click(screen.getByText("Layer 7（スクロール）"));
    expect(onApply).toHaveBeenCalledWith({ behaviorId: 11, param1: 27, param2: 0 });
  });

  it("omits the internal gesture layer from layer behavior targets", () => {
    const onApply = vi.fn();
    const layersWithInternal = Array.from({ length: 10 }, (_, index) => ({
      id: index === 9 ? 92 : index + 20,
      index,
      name: index === 9 ? "Gesture" : `Layer ${index}`,
    }));
    render(<LayersTab behaviors={mockBehaviors} layers={layersWithInternal} onApplyBinding={onApply} />);

    fireEvent.click(screen.getByText("レイヤー切替"));

    expect(screen.queryByText("Gesture")).toBeNull();
  });
});
