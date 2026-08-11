import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OsModeProvider } from "../OsModeContext";
import { BehaviorBindingPicker } from "./BehaviorBindingPicker";

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
});
