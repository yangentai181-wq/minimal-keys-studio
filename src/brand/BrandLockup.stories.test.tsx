import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconScalePreview } from "./BrandLockup.stories";

describe("IconScalePreview", () => {
  it("wraps the fixed-size icon samples instead of shrinking them", () => {
    const { container } = render(<IconScalePreview />);

    expect(container.firstElementChild).toHaveClass("flex-wrap");

    for (const size of [16, 32, 128, 512]) {
      expect(screen.getByRole("img", { name: `Key Studio ${size}px` })).toHaveStyle({
        width: `${size}px`,
        height: `${size}px`,
      });
      expect(screen.getByText(`${size}px`)).toBeInTheDocument();
    }
  });
});
