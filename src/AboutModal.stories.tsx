import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AboutModal } from "./AboutModal";

const meta = {
  title: "Application/AboutModal",
  component: AboutModal,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AboutModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function OpenAboutModal() {
  const [open, setOpen] = useState(true);

  return <AboutModal open={open} onClose={() => setOpen(false)} />;
}

export const Open: Story = {
  args: { open: true, onClose: () => {} },
  render: () => <OpenAboutModal />,
};
