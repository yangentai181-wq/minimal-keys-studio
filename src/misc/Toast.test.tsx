import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function ToastHarness() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast("保存しました", "success")}>成功</button>
      <button onClick={() => toast("保存できませんでした", "error")}>失敗</button>
    </>
  );
}

describe("ToastProvider", () => {
  it("announces success politely and errors assertively", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "成功" }));

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("data-motion-state", "enter");

    fireEvent.click(screen.getByRole("button", { name: "失敗" }));

    expect(screen.getByRole("alert")).toHaveTextContent("保存できませんでした");
  });
});
