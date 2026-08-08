import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PickerTabs } from "./PickerTabs";
import { OsModeProvider } from "../../OsModeContext";

const fakeBehaviors = [
  { id: 10, displayName: "Key Press", metadata: [] },
  { id: 20, displayName: "Momentary Layer", metadata: [] },
  { id: 30, displayName: "Toggle Layer", metadata: [] },
  { id: 40, displayName: "Sticky Layer", metadata: [] },
  { id: 50, displayName: "Mod-Tap", metadata: [] },
  { id: 60, displayName: "Layer-Tap", metadata: [] },
];

describe("PickerTabs", () => {
  it("renders six tab buttons", () => {
    render(
      <OsModeProvider>
        <PickerTabs
          keyPosition={37}
          behaviors={fakeBehaviors}
          layers={[{ id: 0, index: 0, name: "Layer 0" }]}
          onApplyBinding={() => {}}
        />
      </OsModeProvider>
    );
    expect(screen.getByText("ショートカット")).toBeDefined();
    expect(screen.getByText("文字・記号")).toBeDefined();
    expect(screen.getByText("レイヤー")).toBeDefined();
    expect(screen.getByText("修飾キー")).toBeDefined();
    expect(screen.getByText("日本語")).toBeDefined();
    expect(screen.getByText("システム")).toBeDefined();
    expect(screen.getByTestId("picker-tab-content")).not.toHaveClass(
      "overflow-y-auto",
    );
    // OS toggle is now in AppHeader, not PickerTabs
  });

  it("defaults to ショートカット tab with おすすめ for thumb key", () => {
    render(
      <OsModeProvider>
        <PickerTabs
          keyPosition={37}
          behaviors={fakeBehaviors}
          layers={[{ id: 0, index: 0, name: "Layer 0" }]}
          onApplyBinding={() => {}}
        />
      </OsModeProvider>
    );
    expect(screen.getByText("おすすめ")).toBeDefined();
  });

  it("defaults to ショートカット tab without おすすめ for non-thumb key", () => {
    render(
      <OsModeProvider>
        <PickerTabs
          keyPosition={9999}
          behaviors={fakeBehaviors}
          layers={[{ id: 0, index: 0, name: "Layer 0" }]}
          onApplyBinding={() => {}}
        />
      </OsModeProvider>
    );
    expect(screen.queryByText("おすすめ")).toBeNull();
  });

  it("passes the current OS mode to Mod-Tap choices", () => {
    render(
      <OsModeProvider>
        <PickerTabs
          keyPosition={37}
          behaviors={fakeBehaviors}
          layers={[{ id: 0, index: 0, name: "Layer 0" }]}
          onApplyBinding={() => {}}
        />
      </OsModeProvider>,
    );

    fireEvent.click(screen.getByText("修飾キー"));
    fireEvent.click(screen.getByText("Mod-Tap"));
    fireEvent.click(screen.getByText("Ctrl (左)"));

    expect(screen.getByRole("option", { name: "Win (左)" })).toBeTruthy();
  });
});
