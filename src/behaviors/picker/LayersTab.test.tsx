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
        osMode="mac"
        onApplyBinding={onApply}
      />,
    );
    expect(screen.getByText("一時レイヤー")).toBeTruthy();
    expect(screen.getByText("レイヤー切替")).toBeTruthy();
    expect(screen.getByText("レイヤー / タップ")).toBeTruthy();
    expect(screen.getByText("押している間スクロール")).toBeTruthy();
    expect(screen.getByText("押している間ポインター精密")).toBeTruthy();
  });

  it("applies scroll hold action with the selected tap key", () => {
    const onApply = vi.fn();
    render(<LayersTab behaviors={mockBehaviors} layers={[...layers, { id: 7, index: 3, name: "Scroll" }]} osMode="mac" onApplyBinding={onApply} />);

    fireEvent.click(screen.getByText("押している間スクロール"));
    fireEvent.change(screen.getByRole("combobox", { name: "タップキーを選択" }), { target: { value: "0" } });
    fireEvent.click(screen.getByText("適用する"));

    expect(onApply).toHaveBeenCalledWith({ behaviorId: 12, param1: 7, param2: (7 << 16) + 44 });
  });

  it("disables a missing fixed functional layer with a Japanese reason", () => {
    const onApply = vi.fn();
    render(<LayersTab behaviors={mockBehaviors} layers={layers} osMode="mac" onApplyBinding={onApply} />);

    expect(screen.getByText("ポインター精密用レイヤーがありません")).toBeTruthy();
    expect(screen.getByRole("button", { name: "押している間ポインター精密" })).toHaveAttribute("disabled");
  });

  it("associates a disabled functional action with its reason", () => {
    const onApply = vi.fn();
    render(<LayersTab behaviors={mockBehaviors} layers={layers} osMode="mac" onApplyBinding={onApply} />);

    const button = screen.getByRole("button", { name: "押している間ポインター精密" });
    const reason = screen.getByText("ポインター精密用レイヤーがありません");
    expect(button).toHaveAttribute("aria-describedby", reason.id);
  });

  it("disables functional actions when Layer-Tap is unavailable", () => {
    const onApply = vi.fn();
    const behaviorsWithoutLayerTap = mockBehaviors.filter((behavior) => behavior.displayName !== "Layer-Tap");
    render(<LayersTab behaviors={behaviorsWithoutLayerTap} layers={[...layers, { id: 7, index: 3, name: "Scroll" }, { id: 8, index: 4, name: "Precision" }]} osMode="mac" onApplyBinding={onApply} />);

    expect(screen.getByRole("button", { name: "押している間スクロール" })).toHaveAttribute("disabled");
    expect(screen.getByRole("button", { name: "押している間ポインター精密" })).toHaveAttribute("disabled");
    expect(screen.getAllByText("Layer-Tap が利用できません")).toHaveLength(2);
  });

  it("shows layer selection after behavior click", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        osMode="mac"
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
        osMode="mac"
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
        osMode="mac"
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
        osMode="mac"
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
        osMode="mac"
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
        osMode="mac"
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

  it("Layer-Tap: clears an unapplied tap key when OS mode changes", () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        osMode="mac"
        onApplyBinding={onApply}
      />,
    );
    fireEvent.click(screen.getByText("レイヤー / タップ"));
    fireEvent.click(screen.getByText("Symbols"));
    fireEvent.change(
      screen.getByRole("combobox", { name: "タップキーを選択" }),
      { target: { value: "20" } },
    );
    expect(screen.getByText("適用する")).not.toHaveAttribute("disabled");

    rerender(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        osMode="windows"
        onApplyBinding={onApply}
      />,
    );

    expect(screen.getByText("適用する")).toHaveAttribute("disabled");
    expect(screen.getByRole("option", { name: "Win (左)" })).toBeTruthy();
  });

  it("LAYER_TAP_MKP: applies selected layer plus mouse button", () => {
    const onApply = vi.fn();
    render(
      <LayersTab
        behaviors={mockBehaviors}
        layers={layers}
        osMode="mac"
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
      { id: 7, index: 0, name: "Scroll" },
      { id: 0, index: 1, name: "Base" },
      { id: 4, index: 2, name: "AutoMouse" },
    ];

    it("shows （スクロール） suffix for scroll layer ID 7", () => {
      const onApply = vi.fn();
      render(
        <LayersTab
          behaviors={mockBehaviors}
          layers={layersWithRoles}
          osMode="mac"
          onApplyBinding={onApply}
        />,
      );
      fireEvent.click(screen.getByText("一時レイヤー"));
      expect(screen.getByText("Scroll（スクロール）")).toBeTruthy();
    });

    it("shows （自動マウス） suffix for auto mouse layer ID 4", () => {
      const onApply = vi.fn();
      render(
        <LayersTab
          behaviors={mockBehaviors}
          layers={layersWithRoles}
          osMode="mac"
          onApplyBinding={onApply}
        />,
      );
      fireEvent.click(screen.getByText("一時レイヤー"));
      expect(screen.getByText("AutoMouse（自動マウス）")).toBeTruthy();
    });

    it("shows no role suffix for plain layer ID 0", () => {
      const onApply = vi.fn();
      render(
        <LayersTab
          behaviors={mockBehaviors}
          layers={layersWithRoles}
          osMode="mac"
          onApplyBinding={onApply}
        />,
      );
      fireEvent.click(screen.getByText("一時レイヤー"));
      expect(screen.getByText("Base")).toBeTruthy();
    });
  });

  it("omits the internal precision layer ID for every layer behavior", () => {
    const onApply = vi.fn();
    const layersWithInternal = [
      { id: 7, index: 0, name: "Scroll" },
      { id: 8, index: 1, name: "Precision" },
      { id: 0, index: 2, name: "Base" },
    ];
    render(<LayersTab behaviors={mockBehaviors} layers={layersWithInternal} osMode="mac" onApplyBinding={onApply} />);

    fireEvent.click(screen.getByText("レイヤー切替"));

    expect(screen.queryByText("Precision")).toBeNull();
    fireEvent.click(screen.getByText("Scroll（スクロール）"));
    expect(onApply).toHaveBeenCalledWith({ behaviorId: 11, param1: 7, param2: 0 });
  });

  it("offers the gesture layer as a hold target so any key can trigger gestures", () => {
    const onApply = vi.fn();
    const layersWithGesture = Array.from({ length: 10 }, (_, index) => ({
      id: index,
      index,
      name: index === 9 ? "" : `Layer ${index}`,
    }));
    render(<LayersTab behaviors={mockBehaviors} layers={layersWithGesture} osMode="mac" onApplyBinding={onApply} />);

    fireEvent.click(screen.getByText("レイヤー切替"));

    // Named by role: the reserved layer has no user-facing name of its own.
    expect(screen.getByText("ジェスチャー")).toBeInTheDocument();
    // The precision layer (id 8) stays hidden; it is not something to switch to.
    expect(screen.queryByText("Layer 8")).toBeNull();
  });

  it("omits the internal precision layer from layer behavior targets", () => {
    const onApply = vi.fn();
    const layersWithInternal = Array.from({ length: 10 }, (_, index) => ({
      id: index,
      index,
      name: index === 8 ? "Precision" : `Layer ${index}`,
    }));
    render(<LayersTab behaviors={mockBehaviors} layers={layersWithInternal} osMode="mac" onApplyBinding={onApply} />);

    fireEvent.click(screen.getByText("レイヤー切替"));

    expect(screen.queryByText("Precision")).toBeNull();
  });
});
