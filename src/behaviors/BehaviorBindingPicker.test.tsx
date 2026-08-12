import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OsModeProvider } from "../OsModeContext";
import { BehaviorBindingPicker } from "./BehaviorBindingPicker";

const behaviors = [
  { id: 1, displayName: "Key Press", metadata: [] },
  { id: 20, displayName: "Mod-Tap", metadata: [] },
  { id: 30, displayName: "Layer-Tap", metadata: [] },
];

describe("BehaviorBindingPicker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pulses the current setting only after a choice is applied", () => {
    vi.useFakeTimers();
    const onBindingChanged = vi.fn();
    render(
      <OsModeProvider>
        <BehaviorBindingPicker
          binding={{ behaviorId: 10, param1: 4, param2: 0 }}
          behaviors={[{ id: 10, displayName: "Key Press", metadata: [] }]}
          layers={[{ id: 0, index: 0, name: "Base" }]}
          onBindingChanged={onBindingChanged}
        />
      </OsModeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "文字・記号" }));
    fireEvent.click(screen.getByRole("button", { name: "A" }));

    expect(screen.getByTestId("current-binding-feedback")).toHaveAttribute("data-motion-state", "confirmed");
    expect(onBindingChanged).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(220));

    expect(screen.getByTestId("current-binding-feedback")).not.toHaveAttribute("data-motion-state");
  });

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

  it("keeps a catalog-external current Layer-Tap key selected", () => {
    render(
      <OsModeProvider>
        <BehaviorBindingPicker
          binding={{ behaviorId: 30, param1: 0, param2: 0x020700ee }}
          behaviors={behaviors}
          layers={[{ id: 0, index: 0, name: "Base" }]}
          onBindingChanged={vi.fn()}
        />
      </OsModeProvider>,
    );

    fireEvent.click(screen.getByText("レイヤー"));
    fireEvent.click(screen.getByRole("button", { name: "レイヤー / タップ" }));
    fireEvent.click(screen.getByText("Base"));

    expect(screen.getByRole("option", { name: "Key 238" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "タップキーを選択" })).toHaveValue("0");
  });

  it("does not expose a non-keyboard current Layer-Tap tap key", () => {
    render(
      <OsModeProvider>
        <BehaviorBindingPicker
          binding={{ behaviorId: 30, param1: 0, param2: 0x000c00e9 }}
          behaviors={behaviors}
          layers={[{ id: 0, index: 0, name: "Base" }]}
          onBindingChanged={vi.fn()}
        />
      </OsModeProvider>,
    );

    fireEvent.click(screen.getByText("レイヤー"));
    fireEvent.click(screen.getByRole("button", { name: "レイヤー / タップ" }));
    fireEvent.click(screen.getByText("Base"));

    expect(screen.queryByRole("option", { name: "Key 233" })).toBeNull();
  });
});
