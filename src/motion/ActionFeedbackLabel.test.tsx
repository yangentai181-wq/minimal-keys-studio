import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionFeedbackLabel } from "./ActionFeedbackLabel";

describe("ActionFeedbackLabel", () => {
  it("shows a decorative check only for confirmed success", () => {
    const { rerender } = render(
      <ActionFeedbackLabel idleLabel="保存" pendingLabel="保存中…" successLabel="保存済み" pending={false} success={false} />,
    );
    expect(screen.getByText("保存")).toBeInTheDocument();
    rerender(<ActionFeedbackLabel idleLabel="保存" pendingLabel="保存中…" successLabel="保存済み" pending={false} success />);
    expect(screen.getByText("保存済み")).toBeInTheDocument();
    expect(screen.getByTestId("action-success-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("prioritizes pending over a previous success", () => {
    render(<ActionFeedbackLabel idleLabel="保存" pendingLabel="保存中…" successLabel="保存済み" pending success />);
    expect(screen.getByText("保存中…")).toBeVisible();
    expect(screen.queryByTestId("action-success-icon")).not.toBeInTheDocument();
  });
});
