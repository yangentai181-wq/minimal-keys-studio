# Compact Editor Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the complete key-assignment workflow visible without vertical scrolling while making connection status compact and realtime key labels readable.

**Architecture:** Preserve the existing editor/monitor component boundaries and change only their vertical allocation and presentation. `StudioConnectionOverview` will expose four accessible icon statuses, `Keyboard` will reserve more height for `BehaviorBindingPicker`, and the picker tabs will use dense responsive grids. The realtime layout keeps the current physical-position model but uses larger typography.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Testing Library, Vitest, Storybook

## Global Constraints

- The ordinary connection summary is no taller than 64 px and stays on one row at 800 px window width.
- The complete visible assignment picker fits without internal vertical scrolling at 1200×800 and 800×600.
- Normal realtime key labels target 16–18 CSS px at weight 700; long labels remain at least 14 px and may use two lines.
- Connection details and recovery actions remain available.
- No new runtime dependency or remote asset is introduced.
- Existing untracked `work/` visual artifacts are not modified or committed.

---

## File Structure

- `src/StudioConnectionOverview.tsx` — compact icon status strip and expandable details.
- `src/StudioConnectionOverview.test.tsx` — accessible compact-summary behavior.
- `src/keyboard/Keyboard.tsx` — editor/picker height allocation and scroll boundary.
- `src/keyboard/Keyboard.loading.test.tsx` — rendered picker-panel structure under loaded and loading states.
- `src/behaviors/BehaviorBindingPicker.tsx` — dense current-binding summary.
- `src/behaviors/BehaviorBindingPicker.stories.ts` — 800×600 and 1200×800 visual fixtures.
- `src/behaviors/picker/PickerTabs.tsx` — compact primary tab row and content boundary.
- `src/behaviors/picker/PickerTabs.test.tsx` — tab accessibility and dense layout contract.
- `src/behaviors/picker/LettersTab.tsx` — responsive key grid with compact buttons.
- `src/behaviors/picker/LettersTab.test.tsx` — all 26 letters remain directly rendered.
- `src/behaviors/picker/LayersTab.tsx` — remove the nested vertical scroll boundary.
- `src/behaviors/picker/ModifiersTab.tsx` — remove the nested vertical scroll boundary.
- `src/monitor/MinimalKeysMonitorLayout.tsx` — readable label typography.
- `src/monitor/MinimalKeysMonitorLayout.test.tsx` — short and dual-function label readability.

### Task 1: Compact Accessible Connection Status

**Files:**
- Modify: `src/StudioConnectionOverview.test.tsx`
- Modify: `src/StudioConnectionOverview.tsx`

**Interfaces:**
- Consumes: existing `monitorActive`, `editorAvailable`, pointer/layer snapshot, and `connectionTitle` props.
- Produces: `<ul aria-label="接続状況の概要">` with four fixed-size status items and the unchanged `接続の詳細` button.

- [ ] **Step 1: Write the failing compact-summary test**

Add a test that renders the connected overview and verifies the real component behavior:

```tsx
it("shows four compact icon statuses while keeping details available", () => {
  render(
    <StudioConnectionOverview
      monitorStore={monitorStore()}
      monitorActive
      editorAvailable
      connectionTitle="接続中"
      connectionBody="編集とモニターを利用できます。"
    />,
  );

  const summary = screen.getByRole("list", { name: "接続状況の概要" });
  expect(within(summary).getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByLabelText("右手USBモニター: 接続中")).toHaveClass("h-10", "w-10");
  expect(screen.getByRole("button", { name: "接続の詳細" })).toHaveAttribute("aria-expanded", "false");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/StudioConnectionOverview.test.tsx`

Expected: FAIL because the labelled list and fixed-size icon status do not exist.

- [ ] **Step 3: Replace `DeviceCard` with `DeviceStatusIcon`**

Implement a non-interactive status item with a tooltip and accessible name:

```tsx
function DeviceStatusIcon({ icon, title, detail, active }: DeviceStatusIconProps) {
  return (
    <li
      aria-label={`${title}: ${active ? "接続中" : detail}`}
      title={`${title} — ${detail}`}
      className={cx(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-base-300 bg-white text-base-content/55",
      )}
    >
      {icon}
      <span className={cx("absolute right-0.5 top-0.5 h-2 w-2 rounded-full", active ? "bg-primary" : "bg-base-300")} />
    </li>
  );
}
```

Render the four items in a single `flex` list beside the heading and details action. Move `connectionBody` into the expanded details surface so normal connected state remains within 64 px. Keep `actions` visible only when supplied and allow that exceptional recovery state to wrap.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/StudioConnectionOverview.test.tsx`

Expected: all overview tests PASS, including expanding details.

- [ ] **Step 5: Commit**

```bash
git add src/StudioConnectionOverview.tsx src/StudioConnectionOverview.test.tsx
git commit -m "feat: compact connection status into icon strip"
```

### Task 2: Scroll-Free Assignment Picker

**Files:**
- Modify: `src/keyboard/Keyboard.loading.test.tsx`
- Modify: `src/keyboard/Keyboard.tsx`
- Modify: `src/behaviors/BehaviorBindingPicker.tsx`
- Modify: `src/behaviors/picker/PickerTabs.test.tsx`
- Modify: `src/behaviors/picker/PickerTabs.tsx`
- Modify: `src/behaviors/picker/LettersTab.test.tsx`
- Modify: `src/behaviors/picker/LettersTab.tsx`
- Modify: `src/behaviors/picker/LayersTab.tsx`
- Modify: `src/behaviors/picker/ModifiersTab.tsx`

**Interfaces:**
- Consumes: existing selected binding, behavior catalogue, layers, and modifier flags.
- Produces: `data-testid="binding-picker-panel"` with `overflow-hidden`, plus directly rendered picker choices without nested vertical scrolling.

- [ ] **Step 1: Write failing tests for the scroll policy**

Extend the loaded Keyboard fixture and picker tests:

```tsx
expect(screen.getByTestId("binding-picker-panel")).toHaveClass("overflow-hidden", "min-h-0");
expect(screen.getByTestId("picker-tab-content")).not.toHaveClass("overflow-y-auto");
```

In `LettersTab.test.tsx`, select `文字・記号`, then `A-Z`, and assert all literal labels `A` through `Z` are buttons in the document. The test catches clipping-by-unmounting or pagination, not CSS implementation details.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/keyboard/Keyboard.loading.test.tsx src/behaviors/picker/PickerTabs.test.tsx src/behaviors/picker/LettersTab.test.tsx`

Expected: FAIL because the binding panel still uses `overflow-y-auto` and the content boundary lacks the test contract.

- [ ] **Step 3: Reallocate the editor height**

Change the main grid to:

```tsx
<div className="grid h-full min-h-0 min-w-0 max-w-full grid-cols-[auto_1fr] grid-rows-[minmax(180px,42fr)_minmax(250px,58fr)] bg-base-300">
```

Change the binding panel to:

```tsx
<div data-testid="binding-picker-panel" className="col-start-2 row-start-2 min-h-0 overflow-hidden border-t border-gray-200 bg-white p-2">
```

This reserves at least 250 px for the picker and prevents a second nested scrolling surface.

- [ ] **Step 4: Compact the picker without hiding choices**

Apply these concrete presentation changes:

```tsx
// BehaviorBindingPicker
<div className="flex h-full min-h-0 flex-col gap-1.5">
<div className="flex items-center gap-2 rounded-md border-2 border-primary/50 bg-primary/5 px-2 py-1 text-sm">

// PickerTabs
<div className="flex gap-0.5 overflow-x-auto rounded-lg bg-base-200 p-0.5">
<button className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-all ${activeTab === tab.id ? "bg-white font-medium text-primary shadow-sm" : "text-base-content/50 hover:text-base-content"}`}>
<div data-testid="picker-tab-content" className="min-h-0 flex-1">

// LettersTab
<div className="grid grid-cols-8 gap-1 lg:grid-cols-10 xl:grid-cols-13">
<button className="rounded-md border border-base-300 bg-white px-1.5 py-1.5 text-center text-sm transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary">
```

Remove `max-h-32 overflow-y-auto` from the choice grids in `LayersTab` and `ModifiersTab`; use the same responsive column and compact-button pattern so every option remains directly reachable.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/keyboard/Keyboard.loading.test.tsx src/behaviors/picker/PickerTabs.test.tsx src/behaviors/picker/LettersTab.test.tsx src/behaviors/picker/LayersTab.test.tsx src/behaviors/picker/ModifiersTab.test.tsx`

Expected: all selected picker tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/keyboard/Keyboard.tsx src/keyboard/Keyboard.loading.test.tsx src/behaviors
git commit -m "feat: keep key assignment picker visible"
```

### Task 3: Readable Realtime Key Labels

**Files:**
- Modify: `src/monitor/MinimalKeysMonitorLayout.test.tsx`
- Modify: `src/monitor/MinimalKeysMonitorLayout.tsx`

**Interfaces:**
- Consumes: existing layer labels and pressed positions.
- Produces: key label elements marked with `data-testid="monitor-key-label-<position>"`, using 16 px normal text and 14 px long-label text.

- [ ] **Step 1: Write the failing typography test**

```tsx
render(<MinimalKeysMonitorLayout activeLayerIndex={0} pressed={new Set()} />);
expect(screen.getByTestId("monitor-key-label-0")).toHaveClass("text-base", "font-bold");
expect(screen.getByTestId("monitor-key-label-40")).toHaveClass("text-sm", "font-bold");
```

The expected classes represent the user-visible minimum sizes: Tailwind `text-base` is 16 px and `text-sm` is 14 px.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/monitor/MinimalKeysMonitorLayout.test.tsx`

Expected: FAIL because all key containers currently use `text-xs`.

- [ ] **Step 3: Implement length-aware readable labels**

```tsx
const isLongLabel = label.length > 4 || label.includes(" / ");

<span
  data-testid={`monitor-key-label-${index}`}
  className={cx(
    "line-clamp-2 break-words font-bold leading-tight",
    isLongLabel ? "text-sm" : "text-base",
  )}
>
  {label}
</span>
```

Remove `text-xs` from the key container so it cannot override the label size.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- src/monitor/MinimalKeysMonitorLayout.test.tsx`

Expected: all monitor layout tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/monitor/MinimalKeysMonitorLayout.tsx src/monitor/MinimalKeysMonitorLayout.test.tsx
git commit -m "feat: enlarge realtime monitor key labels"
```

### Task 4: Responsive Visual Fixture and Verification

**Files:**
- Modify: `src/behaviors/BehaviorBindingPicker.stories.ts`

**Interfaces:**
- Consumes: the existing Storybook provider/decorator and behavior fixtures.
- Produces: deterministic `Compact800x600` and `Default1200x800` stories for visual inspection.

- [ ] **Step 1: Add fixed-viewport stories**

Add two stories using the same real `BehaviorBindingPicker` component and complete behavior fixture:

```ts
export const Compact800x600: Story = {
  parameters: { viewport: { defaultViewport: "responsive" } },
  decorators: [(Story) => <div style={{ width: 800, height: 330, overflow: "hidden" }}><Story /></div>],
};

export const Default1200x800: Story = {
  decorators: [(Story) => <div style={{ width: 1200, height: 390, overflow: "hidden" }}><Story /></div>],
};
```

- [ ] **Step 2: Build Storybook**

Run: `npm run build-storybook`

Expected: build succeeds without missing provider or type errors.

- [ ] **Step 3: Run the complete Studio gates**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint has zero warnings, and the production Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/behaviors/BehaviorBindingPicker.stories.ts
git commit -m "test: add compact picker visual fixtures"
```
