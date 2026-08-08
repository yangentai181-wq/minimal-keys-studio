import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TapKeySelect } from "./TapKeySelect";

describe("TapKeySelect", () => {
  it("keeps the placeholder neutral and returns the selected tap key", () => {
    const onChange = vi.fn();
    render(<TapKeySelect osMode="mac" selected={null} onChange={onChange} />);
    const select = screen.getByRole("combobox", {
      name: "タップキーを選択",
    });

    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: "20" } });
    expect(onChange).toHaveBeenCalledWith({ label: "A", hidId: 4 });
  });

  it("shows Windows-specific tap key labels", () => {
    render(<TapKeySelect osMode="windows" selected={null} onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: "Win (左)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Alt (左)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Cmd (左)" })).toBeNull();
  });

  it("keeps a current tap key outside the catalog visible", () => {
    const currentExternal = { label: "Consumer", hidId: 238 };
    render(
      <TapKeySelect
        osMode="mac"
        selected={currentExternal}
        currentExternal={currentExternal}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Consumer" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "タップキーを選択" })).toHaveValue("0");
  });
});
