import type { Meta, StoryObj } from "@storybook/react";
import { createElement } from "react";
import { fn, userEvent, within } from "@storybook/test";
import { BehaviorBindingPicker } from "./BehaviorBindingPicker";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: "Behaviors/BehaviorBindingPicker",
  component: BehaviorBindingPicker,
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
  args: {
    layers: [
      { name: "Base", id: 0, index: 0 },
      { id: 1, index: 1, name: "Num" },
    ],
    onBindingChanged: fn(),
  },
} satisfies Meta<typeof BehaviorBindingPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Example: Story = {
  args: {
    binding: { behaviorId: 0, param1: 0, param2: 0 },
    behaviors: [
      {
        id: 0,
        displayName: "Key Press",
        metadata: [
          {
            param1: [
              { name: "Key", hidUsage: { consumerMax: 0, keyboardMax: 0 } },
            ],
            param2: [],
          },
        ],
      },
    ],
  },
};

const openLettersTab = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "文字・記号" }));
};

export const Compact800x600: Story = {
  ...Example,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) =>
      createElement(
        "div",
        { style: { width: 800, height: 330, overflow: "hidden", padding: 8 } },
        createElement(Story),
      ),
  ],
  play: openLettersTab,
};

export const Default1200x800: Story = {
  ...Example,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) =>
      createElement(
        "div",
        { style: { width: 1200, height: 390, overflow: "hidden", padding: 12 } },
        createElement(Story),
      ),
  ],
  play: openLettersTab,
};
