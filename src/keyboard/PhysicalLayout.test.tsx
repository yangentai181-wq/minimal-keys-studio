import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhysicalLayout } from "./PhysicalLayout";

describe("PhysicalLayout", () => {
  it("forwards per-position selected, disabled, and description state to physical key buttons", () => {
    const onPositionClicked = vi.fn();
    render(
      <>
        <PhysicalLayout
          positions={[
            { id: "key-0", x: 0, y: 0, width: 1, height: 1, children: "キー 0" },
            { id: "key-1", x: 1, y: 0, width: 1, height: 1, children: "キー 1" },
          ]}
          positionStates={{
            0: { selected: true },
            1: { disabled: true, describedBy: "key-1-reason" },
          }}
          onPositionClicked={onPositionClicked}
        />
        <p id="key-1-reason">キー 1は使用できません</p>
      </>,
    );

    expect(screen.getByRole("button", { name: "キー 0" })).toHaveAttribute("aria-pressed", "true");
    const disabled = screen.getByRole("button", { name: "キー 1" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription("キー 1は使用できません");
    fireEvent.click(disabled);
    expect(onPositionClicked).not.toHaveBeenCalled();
  });

  it("renders hold-action positions with an orange border and accessibility text", () => {
    render(
      <PhysicalLayout
        positions={[{ id: "hold-key", x: 0, y: 0, width: 1, height: 1, hasHoldAction: true, children: "A" }]}
      />,
    );

    const key = screen.getByRole("button", { name: /A.*長押し動作あり/ });
    expect(key).toHaveClass("border-2", "border-orange-500");
  });
});
