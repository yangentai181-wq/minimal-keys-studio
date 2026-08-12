import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AboutModal } from "./AboutModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

describe("AboutModal branding", () => {
  it("introduces Key Studio before ZMK credits", () => {
    render(<AboutModal open onClose={vi.fn()} />);

    const keyStudio = screen.getByRole("heading", { name: "Key Studio" });
    const credits = screen.getByRole("heading", { name: "ZMKへの謝辞" });

    expect(
      keyStudio.compareDocumentPosition(credits) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("プロ向けキーボード設定・モニタリングツール"),
    ).toBeInTheDocument();
    expect(screen.getByText("現在はminimal-keysに対応")).toBeInTheDocument();
    expect(screen.getByText(/ZMK Studioを基盤/)).toBeInTheDocument();
  });
});
