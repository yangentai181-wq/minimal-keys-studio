import { render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { LicenseNoticeModal } from "./LicenseNoticeModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

it("frames the unchanged ZMK NOTICE as a Key Studio dependency credit", () => {
  render(<LicenseNoticeModal open onClose={vi.fn()} />);

  expect(screen.getByText(/Key Studioには/)).toBeInTheDocument();
  expect(screen.getByText(/Apache 2.0/)).toBeInTheDocument();
  expect(screen.getByText(/ZMK Studio/, { selector: "p" })).toBeInTheDocument();
});
