import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "./BrandLockup";

describe("BrandLockup", () => {
  it("renders the approved name, icon, and optional support copy", () => {
    render(<BrandLockup size="standard" tagline="現在はminimal-keysに対応" />);

    expect(screen.getByText("Key Studio")).toBeInTheDocument();
    expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Key Studio" })).toHaveAttribute(
      "src",
      expect.stringContaining("icons/key-studio-icon.svg"),
    );
  });

  it("keeps the compact lockup to name and icon only", () => {
    render(<BrandLockup size="compact" />);

    expect(screen.getByText("Key Studio")).toBeInTheDocument();
    expect(screen.queryByText("現在はminimal-keysに対応")).not.toBeInTheDocument();
  });
});
