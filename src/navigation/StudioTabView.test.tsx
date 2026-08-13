import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { StudioTabView } from "./StudioTabView";

it("keeps navigation fixed and marks only the active content as entering", () => {
  const { rerender } = render(
    <StudioTabView activeTab="keymap" onSelectTab={() => {}} renderTab={(tab) => <p>{tab}</p>} />,
  );
  expect(screen.getByTestId("studio-tab-content")).toHaveAttribute("data-motion-state", "enter");
  rerender(<StudioTabView activeTab="combo" onSelectTab={() => {}} renderTab={(tab) => <p>{tab}</p>} />);
  expect(screen.getByTestId("studio-tab-content")).toHaveAttribute("data-motion-view", "combo");
  expect(screen.getByTestId("studio-tab-indicator")).toBeInTheDocument();
});
