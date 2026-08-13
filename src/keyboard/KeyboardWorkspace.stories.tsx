import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/test";
import { useState } from "react";

import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
import { MinimalKeysMonitorLayout } from "../monitor/MinimalKeysMonitorLayout";
import { createMonitorStore } from "../monitor/monitorStore";
import { MonitorKeymapProvider } from "./MonitorKeymapContext";
import { KeyboardWorkspace } from "./KeyboardWorkspace";

const monitorStore = createMonitorStore((notify) => {
  notify();
  return () => {};
});
monitorStore.push({ kind: "layer", defaultLayer: 0, activeLayerMask: 1 });
monitorStore.push({ kind: "key", position: 2, pressed: true });
monitorStore.push({ kind: "holdTap", position: 2, phase: "hold" });
monitorStore.push({
  kind: "pointer",
  dx: 4,
  dy: -2,
  wheel: 0,
  hwheel: 0,
  buttons: 0,
});

function MockEditor() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(165px,52fr)_minmax(155px,48fr)] gap-2 bg-base-300 p-2">
      <MinimalKeysMonitorLayout
        activeLayerMask={1}
        pressed={new Set([16])}
        className="h-full min-h-0 bg-white [&_[role=grid]]:!h-full [&_[role=grid]]:!min-w-0 [&_[role=grid]]:!aspect-auto"
      />
      <section className="min-h-0 overflow-hidden rounded-lg border border-base-300 bg-white p-3 shadow-sm">
        <div className="rounded-lg border-2 border-primary/45 bg-primary/5 px-3 py-2 text-sm">
          <strong className="text-primary">現在の設定:</strong>
          <span className="ml-2 font-bold">キー入力 → B</span>
        </div>
        <div className="mt-2 flex min-h-11 items-center gap-5 overflow-hidden rounded-lg bg-base-200 px-3 text-sm font-bold text-base-content/55">
          <span>ショートカット</span>
          <span className="rounded-lg bg-white px-3 py-2 text-primary shadow-sm">
            文字・記号
          </span>
          <span>レイヤー</span>
          <span>修飾キー</span>
          <span>日本語</span>
          <span>システム</span>
        </div>
        <div className="mt-2 grid grid-cols-8 gap-2">
          {"ABCDEFGH".split("").map((label) => (
            <button
              key={label}
              type="button"
              className={`min-h-11 rounded-lg border text-base font-bold ${label === "B" ? "border-primary bg-primary/10 text-primary" : "border-base-300 bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const systemBehaviors = [
  { id: 10, displayName: "Key Press", metadata: [] },
  { id: 114, displayName: "Caps Word", metadata: [] },
  { id: 109, displayName: "External Power", metadata: [] },
  { id: 115, displayName: "Grave/Escape", metadata: [] },
  { id: 110, displayName: "Key Repeat", metadata: [] },
  { id: 111, displayName: "Key Toggle", metadata: [] },
  { id: 112, displayName: "Studio Unlock", metadata: [] },
  { id: 113, displayName: "Reset", metadata: [] },
  { id: 31, displayName: "Transparent", metadata: [] },
  { id: 116, displayName: "Bootloader", metadata: [] },
  { id: 117, displayName: "Output Selection", metadata: [] },
  { id: 32, displayName: "Bluetooth", metadata: [] },
  { id: 30, displayName: "None", metadata: [] },
];

function SystemPickerEditor() {
  const [binding, setBinding] = useState({ behaviorId: 10, param1: 6, param2: 0 });
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(150px,42fr)_minmax(160px,58fr)] gap-2 bg-base-300 p-2">
      <MinimalKeysMonitorLayout
        activeLayerMask={1}
        pressed={new Set([16])}
        className="h-full min-h-0 bg-white [&_[role=grid]]:!h-full [&_[role=grid]]:!min-w-0 [&_[role=grid]]:!aspect-auto"
      />
      <section className="min-h-0 overflow-hidden rounded-lg border border-base-300 bg-white p-2 shadow-sm">
        <BehaviorBindingPicker
          binding={binding}
          behaviors={systemBehaviors}
          layers={[
            { id: 0, index: 0, name: "Base" },
            { id: 1, index: 1, name: "Live" },
          ]}
          keyPosition={37}
          onBindingChanged={setBinding}
        />
      </section>
    </div>
  );
}

const meta = {
  title: "Keyboard/KeyboardWorkspace",
  component: KeyboardWorkspace,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <MonitorKeymapProvider>
        <div className="h-screen min-h-0 bg-[#F8FAFC]">
          <Story />
        </div>
      </MonitorKeymapProvider>
    ),
  ],
  args: {
    editor: <MockEditor />,
    monitorStore,
    monitorActive: true,
  },
} satisfies Meta<typeof KeyboardWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

const viewports = {
  desktop800x600: {
    name: "800 × 600",
    styles: { width: "800px", height: "600px" },
  },
  desktop1200x800: {
    name: "1200 × 800",
    styles: { width: "1200px", height: "800px" },
  },
};

function SizedWorkspace({
  width,
  height,
  args,
}: {
  width: number;
  height: number;
  args: React.ComponentProps<typeof KeyboardWorkspace>;
}) {
  return (
    <div style={{ width, height }} className="overflow-hidden bg-[#F8FAFC]">
      <KeyboardWorkspace {...args} />
    </div>
  );
}

export const Editor800x600: Story = {
  render: (args) => <SizedWorkspace width={800} height={600} args={args} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop800x600" },
  },
};

export const Monitor800x600: Story = {
  render: (args) => <SizedWorkspace width={800} height={600} args={args} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop800x600" },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "リアルタイム" }),
    );
  },
};

export const Monitor1200x800: Story = {
  render: (args) => <SizedWorkspace width={1200} height={800} args={args} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop1200x800" },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "リアルタイム" }),
    );
  },
};

function IntegratedFrame(args: React.ComponentProps<typeof KeyboardWorkspace>) {
  return (
    <div className="grid h-screen min-h-[600px] grid-rows-[48px_64px_40px_minmax(0,1fr)_28px] overflow-hidden bg-[#F8FAFC] text-base-content">
      <header className="flex items-center border-b border-base-300 bg-white px-4 text-sm font-bold">
        Key Studio
      </header>
      <section className="flex items-center gap-3 border-b border-base-300 bg-base-200 px-3">
        <strong className="text-sm">接続状態</strong>
        <div className="flex gap-1.5" aria-label="接続状況の概要">
          {["右手USB", "エディター", "統合", "マウス"].map((label) => (
            <span
              key={label}
              title={label}
              className="h-10 w-10 rounded-lg border border-primary/40 bg-primary/10"
            />
          ))}
        </div>
        <span className="ml-auto text-xs text-base-content/55">接続の詳細</span>
      </section>
      <nav className="flex items-center gap-4 border-b border-base-300 bg-white px-3 text-sm font-bold text-base-content/55">
        <span className="text-primary">キーマップ</span>
        <span>長押し設定</span>
        <span>エンコーダー</span>
        <span>トラックボール</span>
      </nav>
      <div className="min-h-0">
        <KeyboardWorkspace {...args} />
      </div>
      <footer
        data-testid="story-app-footer"
        className="border-t border-base-300 bg-white"
      />
    </div>
  );
}

export const IntegratedEditor800x600: Story = {
  render: (args) => <IntegratedFrame {...args} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop800x600" },
  },
};

export const IntegratedMonitor800x600: Story = {
  render: (args) => <IntegratedFrame {...args} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop800x600" },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "リアルタイム" }),
    );
  },
};

const openSystemTab = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "システム" }));
};

export const IntegratedSystemPicker800x600: Story = {
  name: "Integrated System Picker 800x600",
  render: (args) => <IntegratedFrame {...args} editor={<SystemPickerEditor />} />,
  parameters: {
    __id: "keyboard-keyboardworkspace--integrated-system-picker-800x600",
    viewport: { viewports, defaultViewport: "desktop800x600" },
  },
  play: openSystemTab,
};

export const IntegratedSystemPicker1200x800: Story = {
  name: "Integrated System Picker 1200x800",
  render: (args) => <IntegratedFrame {...args} editor={<SystemPickerEditor />} />,
  parameters: {
    __id: "keyboard-keyboardworkspace--integrated-system-picker-1200x800",
    viewport: { viewports, defaultViewport: "desktop1200x800" },
  },
  play: openSystemTab,
};
