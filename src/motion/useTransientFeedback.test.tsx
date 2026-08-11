import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTransientFeedback } from "./useTransientFeedback";

function Harness() {
  const feedback = useTransientFeedback(220);
  return (
    <>
      <button data-motion-state={feedback.active ? "confirmed" : undefined} onClick={feedback.trigger}>
        確定
      </button>
      <button onClick={feedback.clear}>消去</button>
    </>
  );
}

describe("useTransientFeedback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("activates immediately and clears after the requested duration", () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "確定" }));

    expect(screen.getByRole("button", { name: "確定" })).toHaveAttribute("data-motion-state", "confirmed");

    act(() => vi.advanceTimersByTime(220));

    expect(screen.getByRole("button", { name: "確定" })).not.toHaveAttribute("data-motion-state");
  });

  it("clears active feedback and cancels its pending timeout", () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "確定" }));
    fireEvent.click(screen.getByRole("button", { name: "消去" }));

    expect(screen.getByRole("button", { name: "確定" })).not.toHaveAttribute("data-motion-state");
    act(() => vi.advanceTimersByTime(220));
    expect(screen.getByRole("button", { name: "確定" })).not.toHaveAttribute("data-motion-state");
  });
});
