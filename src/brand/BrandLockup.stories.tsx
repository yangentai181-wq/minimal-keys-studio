import type { Meta, StoryObj } from "@storybook/react";
import { BrandLockup } from "./BrandLockup";
import identity from "./identity.json";

const meta = {
  title: "Brand/BrandLockup",
  component: BrandLockup,
  parameters: { layout: "centered" },
} satisfies Meta<typeof BrandLockup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = { args: { size: "compact" } };
export const Standard: Story = {
  args: { size: "standard", tagline: "現在はminimal-keysに対応" },
};

export const IconScale: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-6 bg-base-200 p-8">
      {[16, 32, 128, 512].map((size) => (
        <figure key={size} className="grid gap-2 text-center text-sm">
          <img
            src={`${import.meta.env.BASE_URL}${identity.iconPath}`}
            alt={`Key Studio ${size}px`}
            style={{ width: size, height: size }}
          />
          <figcaption>{size}px</figcaption>
        </figure>
      ))}
    </div>
  ),
};

export const LightAndDarkDock: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 bg-base-200 p-8">
      {["bg-white", "bg-slate-900"].map((background) => (
        <div key={background} className={`grid h-40 w-40 place-items-center rounded-3xl ${background}`}>
          <img
            src={`${import.meta.env.BASE_URL}${identity.iconPath}`}
            alt="Key Studio Dock icon"
            className="h-20 w-20"
          />
        </div>
      ))}
    </div>
  ),
};
