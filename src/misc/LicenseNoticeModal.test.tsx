import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { LicenseNoticeModal } from "./LicenseNoticeModal";
import identity from "../brand/identity.json";

const originalProductName = identity.productName;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

beforeEach(() => {
  identity.productName = "Identity Test Studio";
});

afterEach(() => {
  identity.productName = originalProductName;
});

it("frames the unchanged ZMK NOTICE as an identity product dependency credit", () => {
  render(<LicenseNoticeModal open onClose={vi.fn()} />);

  expect(screen.getByText(`${identity.productName}には、Apache 2.0で公開されたZMK Studio由来のコードが含まれています。以下は同梱している原文のNOTICEです。`)).toBeInTheDocument();
  expect(screen.getByText(/Apache 2.0/)).toBeInTheDocument();
  expect(screen.getByText(/ZMK Studio/, { selector: "p" })).toBeInTheDocument();
});
