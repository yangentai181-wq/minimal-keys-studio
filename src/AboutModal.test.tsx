import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutModal } from "./AboutModal";
import identity from "./brand/identity.json";

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

describe("AboutModal branding", () => {
  it("introduces the identity product name before ZMK credits", () => {
    render(<AboutModal open onClose={vi.fn()} />);

    const keyStudio = screen.getByRole("heading", {
      name: identity.productName,
    });
    const credits = screen.getByRole("heading", { name: "ZMKへの謝辞" });

    expect(
      keyStudio.compareDocumentPosition(credits) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("プロ向けキーボード設定・モニタリングツール"),
    ).toBeInTheDocument();
    expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
    expect(
      screen.getByText(
        `${identity.productName}はZMK Studioを基盤に、minimal-keys向けの編集・モニタリング機能を統合したアプリです。`,
      ),
    ).toBeInTheDocument();
  });
});
