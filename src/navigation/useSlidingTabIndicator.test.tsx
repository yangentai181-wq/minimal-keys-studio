import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { useSlidingTabIndicator } from "./useSlidingTabIndicator";

function Harness({ active }: { active: "a" | "b" }) {
  const indicator = useSlidingTabIndicator(active);
  return (
    <nav ref={indicator.containerRef} data-testid="nav">
      <button ref={indicator.registerItem("a")}>A</button>
      <button ref={indicator.registerItem("b")}>B</button>
      <output data-testid="indicator">{JSON.stringify(indicator.indicatorStyle)}</output>
    </nav>
  );
}

it("measures the active item relative to its container and updates on resize", () => {
  let bLeft = 90;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const label = this.textContent;
    const left = label === "B" ? bLeft : label === "A" ? 20 : 10;
    const width = label === "B" ? 70 : label === "A" ? 60 : 200;
    return {
      x: left, y: 0, left, top: 0, width, height: 40,
      right: left + width, bottom: 40, toJSON: () => ({}),
    };
  });
  render(<Harness active="b" />);
  expect(screen.getByTestId("indicator")).toHaveTextContent('{"left":80,"width":70}');
  bLeft = 100;
  fireEvent(window, new Event("resize"));
  expect(screen.getByTestId("indicator")).toHaveTextContent('{"left":90,"width":70}');
});
