import type { Meta, StoryObj } from "@storybook/react";
import { createElement } from "react";
import { AppHeader } from "./AppHeader";
import { OsModeProvider } from "./OsModeContext";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: "Application/AppHeader",
  component: AppHeader,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: "centered",
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {
    // backgroundColor: { control: 'color' },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
  args: {},
  decorators: [
    (Story) => createElement(OsModeProvider, null, createElement(Story)),
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: {},
};

export const BrandAtMinimumWindow: Story = {
  args: {
    connectedDeviceLabel: "minimal-keys",
    canUndo: true,
    canRedo: true,
    onSave: async () => true,
    onDiscard: () => undefined,
    onUndo: async () => undefined,
    onRedo: async () => undefined,
  },
  parameters: { layout: "fullscreen" },
};
