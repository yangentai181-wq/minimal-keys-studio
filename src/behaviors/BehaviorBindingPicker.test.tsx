import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OsModeProvider } from "../OsModeContext";
import { BehaviorBindingPicker } from "./BehaviorBindingPicker";

const behaviors = [
  { id: 1, displayName: "Key Press", metadata: [] },
  { id: 20, displayName: "Mod-Tap", metadata: [] },
  { id: 30, displayName: "Layer-Tap", metadata: [] },
];

describe("BehaviorBindingPicker", () => {
  it("keeps a catalog-external current Mod-Tap key selected", () => {
    render(
      <OsModeProvider>
        <BehaviorBindingPicker
          binding={{ behaviorId: 20, param1: 0x700e0, param2: 0x020700ee }}
          behaviors={behaviors}
          layers={[{ id: 0, index: 0, name: "Base" }]}
          onBindingChanged={vi.fn()}
        />
      </OsModeProvider>,
    );

    fireEvent.click(screen.getByText("修飾キー"));
    fireEvent.click(screen.getByText("Mod-Tap"));
    fireEvent.click(screen.getByText("Ctrl (左)"));

    expect(screen.getByRole("option", { name: "Key 238" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "タップキーを選択" })).toHaveValue("0");
  });
});
