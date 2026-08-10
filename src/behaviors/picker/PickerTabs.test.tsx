import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PickerTabs } from "./PickerTabs";
import { OsModeProvider } from "../../OsModeContext";

const fakeBehaviors = [
  { id: 10, displayName: "Key Press", metadata: [] },
  { id: 20, displayName: "Momentary Layer", metadata: [] },
  { id: 30, displayName: "Toggle Layer", metadata: [] },
  { id: 40, displayName: "Sticky Layer", metadata: [] },
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
    const content = screen.getByTestId("picker-tab-content");
    expect(content).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "overscroll-contain",
      "[scrollbar-gutter:stable]",
    );
    expect(screen.getByTestId("picker-tabs")).not.toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("picker-tab-bar")).not.toHaveClass("overflow-y-auto");
    // OS toggle is now in AppHeader, not PickerTabs
  });

  it("タブ切替時に候補contentを先頭へ戻す", () => {
    render(
      <div style={{ display: "flex", flexDirection: "column", height: "8rem" }}>
        <OsModeProvider>
          <PickerTabs
            keyPosition={37}
            behaviors={fakeBehaviors}
            layers={[{ id: 0, index: 0, name: "Layer 0" }]}
            onApplyBinding={() => {}}
          />
        </OsModeProvider>
      </div>
    );

    const content = screen.getByTestId("picker-tab-content");
    expect(content).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    content.scrollTop = 120;
    fireEvent.click(screen.getByRole("button", { name: "文字・記号" }));

    expect(content.scrollTop).toBe(0);
    expect(screen.getByText("文字・記号")).toBeDefined();
    expect(content).toContainElement(screen.getByRole("button", { name: "A" }));
    expect(content).toContainElement(screen.getByRole("button", { name: "Z" }));
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
});
