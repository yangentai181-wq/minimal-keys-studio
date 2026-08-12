import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Key } from "./Key";

describe("Key", () => {
  it("keeps a hold-action border inside the outer selected ring", () => {
    render(
      <Key width={1} height={1} oneU={56} selected hasHoldAction>
        A
      </Key>,
    );

    const key = screen.getByRole("button", { name: /A.*長押し動作あり/ });
    expect(key).toHaveClass("border-2", "border-orange-500", "ring-2", "ring-primary/40");
  });
});
