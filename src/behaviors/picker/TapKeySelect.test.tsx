import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TapKeySelect } from "./TapKeySelect";

describe("TapKeySelect", () => {
  it("keeps the placeholder neutral and returns the selected tap key", () => {
    const onChange = vi.fn();
    render(<TapKeySelect selected={null} onChange={onChange} />);
    const select = screen.getByRole("combobox", {
      name: "タップキーを選択",
    });

    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: "6" } });
    expect(onChange).toHaveBeenCalledWith({ label: "A", hidId: 4 });
  });
});
