import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppFooter } from "./AppFooter";
import identity from "./brand/identity.json";

const originalProductName = identity.productName;

beforeEach(() => {
  identity.productName = "Identity Test Studio";
});

afterEach(() => {
  identity.productName = originalProductName;
});

it("shows the identity product name first and keeps ZMK credits accessible", () => {
  const onShowAbout = vi.fn();
  const onShowLicenseNotice = vi.fn();

  render(
    <AppFooter
      onShowAbout={onShowAbout}
      onShowLicenseNotice={onShowLicenseNotice}
    />,
  );

  expect(screen.getByText(identity.productName)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "ZMK Contributorsへの謝辞" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "License NOTICE" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("About ZMK Studio")).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "ZMK Contributorsへの謝辞" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "License NOTICE" }));

  expect(onShowAbout).toHaveBeenCalledOnce();
  expect(onShowLicenseNotice).toHaveBeenCalledOnce();
});
