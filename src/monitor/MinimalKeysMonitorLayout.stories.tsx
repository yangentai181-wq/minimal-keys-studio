import type { Meta, StoryObj } from "@storybook/react";

import { MinimalKeysMonitorLayout } from "./MinimalKeysMonitorLayout";

const meta = {
  title: "Monitor/MinimalKeysMonitorLayout",
  component: MinimalKeysMonitorLayout,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-screen bg-base-200 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MinimalKeysMonitorLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HoldTapDecisions: Story = {
  args: {
    activeLayerIndex: 0,
    pressed: new Set([0, 1, 2]),
    holdTapStates: {
      0: "pending",
      1: "tap",
      2: "hold",
      40: "hold-afterglow",
    },
  },
};
