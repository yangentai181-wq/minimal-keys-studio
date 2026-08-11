import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTransientFeedback } from "./useTransientFeedback";

function Harness() {
  const feedback = useTransientFeedback(220);
  return (
    <button data-motion-state={feedback.active ? "confirmed" : undefined} onClick={feedback.trigger}>
      確定
    </button>
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

    expect(screen.getByRole("button")).toHaveAttribute("data-motion-state", "confirmed");

    act(() => vi.advanceTimersByTime(220));

    expect(screen.getByRole("button")).not.toHaveAttribute("data-motion-state");
  });
});
