import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AlphaLayoutToggle } from "./AlphaLayoutToggle";

describe("AlphaLayoutToggle", () => {
  it("marks the active layout and reports the other one when clicked", async () => {
    const onSelect = vi.fn();
    render(<AlphaLayoutToggle value="qwerty" onSelect={onSelect} />);

    expect(screen.getByRole("radio", { name: "通常配列" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "大西配列" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "大西配列" }));
    expect(onSelect).toHaveBeenCalledWith("oonishi");
  });

  it("keeps the closest layout selected while flagging hand-made changes", () => {
    render(
      <AlphaLayoutToggle value="oonishi" customized onSelect={vi.fn()} />,
    );

    expect(screen.getByRole("radio", { name: "大西配列" })).toBeChecked();
    expect(screen.getByText("一部カスタム済み")).toBeInTheDocument();
  });

  it("blocks input while a write is in flight", async () => {
    const onSelect = vi.fn();
    render(<AlphaLayoutToggle value="qwerty" onSelect={onSelect} busy />);

    expect(screen.getByRole("radio", { name: "大西配列" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "大西配列" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
