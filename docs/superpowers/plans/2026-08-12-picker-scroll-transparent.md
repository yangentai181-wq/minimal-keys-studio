# Key Picker Scroll and Transparent Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 800×600のキー割り当て画面で候補一覧を最後までスクロールでき、「透過（Trans / TRNS）」を先頭付近から選択して既存の保存対象へ反映できるようにする。

**Architecture:** `SystemTab` はAPIが返した実behaviorだけを定義済み優先順へ並べ、`None` と `Transparent` を先頭2件にする。`PickerTabs` は固定タブバーと、絶対配置で高さを拘束した唯一の縦スクロールviewportに分離する。既存の統合KeyboardWorkspace Storyへ実ピッカー・固定フッター・状態更新を差し込み、Codex環境のPlaywrightで800×600と1200×800の幾何・スクロール・選択を検証する。

**Tech Stack:** React 18、TypeScript、Tailwind CSS、Vitest、Testing Library、Storybook 8、Codex bundled Playwright、Tauri 2。

## Global Constraints

- 既存のUI構成、タブ、現在設定表示、ヘッダー保存、Undo/破棄フローを維持する。
- `Transparent` はAPIが返した実behavior IDだけを使用し、存在しないbehaviorを合成しない。
- 透過bindingは `{ behaviorId, param1: 0, param2: 0 }` とする。
- タブバー、現在設定、アプリフッターは固定し、候補一覧だけを縦スクロールさせる。
- 候補末尾とフッターの間に8px以上の視覚余白を確保する。
- タブ切替時に候補一覧を先頭へ戻す既存動作を維持する。
- Firmware、proto、RPC、保存通信、他設定画面は変更しない。
- JavaScriptでwheelイベントを横取りしない。
- Playwrightのために新しいnpm依存を追加しない。
- アプリ起動、BLE、実機キーボード、Firmwareの成功をStudioテストから推測しない。

---

### Task 1: 既存統合画面へ実候補を入れたブラウザ再現Story

**Files:**
- Modify: `src/keyboard/KeyboardWorkspace.stories.tsx`
- Read: `src/behaviors/BehaviorBindingPicker.tsx`
- Read: `src/behaviors/picker/SystemTab.tsx`

**Interfaces:**
- Consumes: `KeyboardWorkspace`、既存 `IntegratedFrame`、`BehaviorBindingPicker`。
- Produces: Story ID `keyboard-keyboardworkspace--integrated-system-picker-800x600` と `keyboard-keyboardworkspace--integrated-system-picker-1200x800`。両Storyは `data-testid="story-app-footer"` を持ち、クリック後にcontrolled `binding` を更新する。

- [ ] **Step 1: 現状の再現Storyが存在しないことを確認する**

Run:

```bash
rg -n 'IntegratedSystemPicker800x600|IntegratedSystemPicker1200x800|story-app-footer' src/keyboard/KeyboardWorkspace.stories.tsx
```

Expected: exit 1、outputなし。

- [ ] **Step 2: 実候補データとcontrolled editorを追加する**

`src/keyboard/KeyboardWorkspace.stories.tsx` のimportへ次を追加する。

```ts
import { useState } from "react";
import { BehaviorBindingPicker } from "../behaviors/BehaviorBindingPicker";
```

`MockEditor` の後に次を追加する。

```ts
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
```

- [ ] **Step 3: 統合frameのfooterを識別可能にし、2画面Storyを追加する**

既存 `IntegratedFrame` のfooterを次へ変更する。

```tsx
<footer
  data-testid="story-app-footer"
  className="border-t border-base-300 bg-white"
/>
```

同ファイル末尾へ追加する。

```ts
const openSystemTab = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "システム" }));
};

export const IntegratedSystemPicker800x600: Story = {
  render: (args) => <IntegratedFrame {...args} editor={<SystemPickerEditor />} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop800x600" },
  },
  play: openSystemTab,
};

export const IntegratedSystemPicker1200x800: Story = {
  render: (args) => <IntegratedFrame {...args} editor={<SystemPickerEditor />} />,
  parameters: {
    viewport: { viewports, defaultViewport: "desktop1200x800" },
  },
  play: openSystemTab,
};
```

- [ ] **Step 4: Storybook buildを実行する**

Run:

```bash
npm run build-storybook
```

Expected: exit 0。既存のchunk-size warningは記録するが失敗扱いにしない。

- [ ] **Step 5: Storybookを起動してPlaywright REDを取る**

Run in a persistent terminal:

```bash
npm run storybook -- --ci --host 127.0.0.1 --no-open
```

Expected: `http://127.0.0.1:6006/` がHTTP 200。

Codex `node_repl` で bundled Playwrightを使い、次を実行する。新しいnpm packageはinstallしない。

```js
var pw = await import("playwright");
var browser = await pw.chromium.launch({ headless: true });
var page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto("http://127.0.0.1:6006/iframe.html?id=keyboard-keyboardworkspace--integrated-system-picker-800x600&viewMode=story");
await page.getByRole("button", { name: "システム" }).click();
var viewport = page.getByTestId("picker-tab-content");
var footer = page.getByTestId("story-app-footer");
var lastCandidate = page.getByRole("button", { name: /^BT プロファイル 2/ });
var before = await viewport.evaluate((element) => ({
  clientHeight: element.clientHeight,
  scrollHeight: element.scrollHeight,
  scrollTop: element.scrollTop,
}));
await lastCandidate.scrollIntoViewIfNeeded();
var candidateBox = await lastCandidate.boundingBox();
var viewportBox = await viewport.boundingBox();
var footerBox = await footer.boundingBox();
if (!candidateBox || !viewportBox || !footerBox) throw new Error("picker geometry unavailable");
if (before.scrollHeight <= before.clientHeight) throw new Error("candidate viewport did not become scrollable");
if (
  candidateBox.y < viewportBox.y ||
  candidateBox.y + candidateBox.height > viewportBox.y + viewportBox.height - 8
) throw new Error("last candidate is outside the picker viewport");
if (candidateBox.y + candidateBox.height > footerBox.y - 8) throw new Error("last candidate is hidden by footer");
```

Expected before production fix: one of the final two assertions fails and reproduces the reported bug. If both pass, do not edit production classes yet; record the geometry and investigate the installed bundle/source mismatch as a blocker to the assumed root cause.

- [ ] **Step 6: Story fixtureをコミットする**

```bash
git add src/keyboard/KeyboardWorkspace.stories.tsx
git commit -m "test: reproduce constrained system picker"
```

---

### Task 2: システム候補の安定順序と透過binding

**Files:**
- Modify: `src/behaviors/picker/SystemTab.tsx:6-48`
- Modify: `src/behaviors/picker/SystemTab.test.tsx`

**Interfaces:**
- Consumes: `systemBehaviorNames: readonly string[]` とAPIの `GetBehaviorDetailsResponse[]`。
- Produces: `availableBehaviors` はAPIに存在するsystem behaviorだけを `systemBehaviorNames` 順で返す。先頭2件は存在する場合 `None`, `Transparent`。クリック契約は `onApplyBinding({ behaviorId, param1: 0, param2: 0 })`。

- [ ] **Step 1: 応答順に依存しないことを示す失敗テストを書く**

`SystemTab.test.tsx` に追加する。

```ts
it("orders None and Transparent first regardless of API response order", () => {
  render(
    <SystemTab
      behaviors={[
        { id: 33, displayName: "Reset", metadata: [] },
        { id: 31, displayName: "Transparent", metadata: [] },
        { id: 30, displayName: "None", metadata: [] },
      ]}
      onApplyBinding={() => {}}
    />,
  );

  expect(
    screen.getAllByRole("button").slice(0, 3).map((button) => button.textContent),
  ).toEqual([
    "無効このキーを無効化する。押しても何も起きない",
    "透過このレイヤーでは何も割り当てず、下のレイヤーの割り当てをそのまま使う",
    "リセットキーボードを再起動する",
  ]);
});

it("does not synthesize Transparent when the API omits it", () => {
  render(
    <SystemTab
      behaviors={[{ id: 30, displayName: "None", metadata: [] }]}
      onApplyBinding={() => {}}
    />,
  );

  expect(screen.queryByRole("button", { name: /^透過/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: focused testでREDを確認する**

Run:

```bash
npm test -- src/behaviors/picker/SystemTab.test.tsx
```

Expected: `orders None and Transparent first...` がFAILし、現状順 `Reset, Transparent, None` が観測される。既存Transparent click testはPASS。

- [ ] **Step 3: API応答を定義順へ並べる最小実装を行う**

`SystemTab.tsx` の `availableBehaviors` を次へ置き換える。

```ts
const availableBehaviors = useMemo(() => {
  const byName = new Map(behaviors.map((behavior) => [behavior.displayName, behavior]));
  return systemBehaviorNames.flatMap((name) => {
    const behavior = byName.get(name);
    return behavior ? [behavior] : [];
  });
}, [behaviors]);
```

`systemBehaviorNames` の先頭 `"None"`, `"Transparent"` は変更しない。Bluetoothの分離とクリック処理も変更しない。

- [ ] **Step 4: focused testをGREENにする**

Run:

```bash
npm test -- src/behaviors/picker/SystemTab.test.tsx
```

Expected: 全件PASS。「透過」クリックはID 31、param1/param2が0のまま。

- [ ] **Step 5: コミットする**

```bash
git add src/behaviors/picker/SystemTab.tsx src/behaviors/picker/SystemTab.test.tsx
git commit -m "fix: prioritize transparent key assignment"
```

---

### Task 3: 候補一覧だけがスクロールする拘束viewport

**Files:**
- Modify: `src/behaviors/picker/PickerTabs.tsx:45-100`
- Modify: `src/behaviors/picker/PickerTabs.test.tsx`
- Modify only if Task 1 browser geometry proves it is the first broken ancestor: `src/behaviors/BehaviorBindingPicker.tsx:58-85`
- Modify only if Task 1 browser geometry proves it is the first broken ancestor: `src/keyboard/Keyboard.tsx:747-771`

**Interfaces:**
- Consumes: `contentRef: RefObject<HTMLDivElement>` と既存 `selectTab(tabId)`。
- Produces: `data-testid="picker-scroll-viewport"` の相対配置flex領域と、その内側にある `data-testid="picker-tab-content"` の唯一の縦スクロール領域。scroll contentは `aria-label="キー割り当て候補"`, `tabIndex={0}` を持つ。

- [ ] **Step 1: viewportの契約を示す失敗テストを書く**

`PickerTabs.test.tsx` の最初のtestへ次を追加する。

```ts
const viewport = screen.getByTestId("picker-scroll-viewport");
expect(viewport).toHaveClass("relative", "min-h-0", "flex-1", "overflow-hidden");
expect(content).toHaveClass(
  "absolute",
  "inset-0",
  "overflow-y-auto",
  "overscroll-contain",
  "pb-2",
);
expect(content).toHaveAttribute("aria-label", "キー割り当て候補");
expect(content).toHaveAttribute("role", "region");
expect(content).toHaveAttribute("tabindex", "0");
expect(screen.getByTestId("picker-tabs")).toHaveClass("overflow-hidden");
```

既存の `content.scrollTop = 120` → タブクリック → `0` testは残す。

- [ ] **Step 2: focused testでREDを確認する**

Run:

```bash
npm test -- src/behaviors/picker/PickerTabs.test.tsx
```

Expected: `picker-scroll-viewport` 不在でFAIL。既存タブ動作testはPASS。

- [ ] **Step 3: 固定タブと拘束scroll viewportへ分離する**

`PickerTabs.tsx` のroot classへ `overflow-hidden` を追加する。

```tsx
<div
  data-testid="picker-tabs"
  className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden"
>
```

現在のtab content divを次の2層へ置き換える。中の各Tab component分岐はそのまま移動する。

```tsx
<div
  data-testid="picker-scroll-viewport"
  className="relative min-h-0 flex-1 overflow-hidden"
>
  <div
    ref={contentRef}
    data-testid="picker-tab-content"
    role="region"
    aria-label="キー割り当て候補"
    tabIndex={0}
    className="absolute inset-0 overflow-y-auto overscroll-contain pb-2 [scrollbar-gutter:stable]"
  >
    <div key={activeTab} data-motion-state="enter" data-motion-view={activeTab}>
      {activeTab === "actions" && (
        <ActionsTab
          keyPosition={keyPosition}
          behaviors={behaviors}
          layers={layers}
          osMode={osMode}
          onApplyBinding={onApplyBinding}
        />
      )}
      {activeTab === "letters" && (
        <LettersTab behaviors={behaviors} onApplyBinding={onApplyBinding} />
      )}
      {activeTab === "layers" && (
        <LayersTab behaviors={behaviors} layers={layers} onApplyBinding={onApplyBinding} />
      )}
      {activeTab === "modifiers" && (
        <ModifiersTab
          behaviors={behaviors}
          layers={layers}
          osMode={osMode}
          onApplyBinding={onApplyBinding}
        />
      )}
      {activeTab === "japanese" && (
        <JapaneseTab behaviors={behaviors} osMode={osMode} onApplyBinding={onApplyBinding} />
      )}
      {activeTab === "system" && (
        <SystemTab behaviors={behaviors} onApplyBinding={onApplyBinding} />
      )}
    </div>
  </div>
</div>
```

`pb-2` はTailwindの8pxで、最後の候補とviewport下端の余白になる。wheel handlerは追加しない。

- [ ] **Step 4: focused testsをGREENにする**

Run:

```bash
npm test -- src/behaviors/picker/PickerTabs.test.tsx src/behaviors/picker/SystemTab.test.tsx src/behaviors/BehaviorBindingPicker.test.tsx
```

Expected: 全件PASS。タブ切替のscrollTop reset、候補クリック、透過bindingが維持される。

- [ ] **Step 5: Playwrightで800×600のscroll geometryをGREENにする**

Task 1で起動したStorybookへ同じPlaywrightを再実行し、次も続けて確認する。

```js
var afterScroll = await viewport.evaluate((element) => ({
  clientHeight: element.clientHeight,
  scrollHeight: element.scrollHeight,
  scrollTop: element.scrollTop,
}));
if (afterScroll.scrollTop <= 0) throw new Error("candidate viewport did not scroll");
await viewport.focus();
await page.keyboard.press("Home");
var homeScrollTop = await viewport.evaluate((element) => element.scrollTop);
await page.keyboard.press("PageDown");
var afterPageDown = await viewport.evaluate((element) => element.scrollTop);
if (homeScrollTop !== 0 || afterPageDown <= homeScrollTop) {
  throw new Error("keyboard PageDown did not move candidate viewport");
}
var transparent = page.getByRole("button", { name: /^透過/ });
await transparent.click();
var current = await page.getByTestId("current-binding-feedback").textContent();
if (!current?.includes("透過")) throw new Error("transparent binding was not reflected");
```

Expected: `scrollHeight > clientHeight`、last candidateがfooterの8px以上上、`scrollTop > 0`、クリック後のcurrent textに `透過`。

Task 1のREDが `BehaviorBindingPicker` または `Keyboard` の祖先高さで発生し、この2層変更後も同じ祖先でoverflowする場合だけ、Playwrightのcomputed geometryで最初に壊れた祖先1箇所へ次の最小classを追加する。

- `BehaviorBindingPicker` root: 既に `h-full min-h-0` があるため、必要なら `overflow-hidden` のみ追加。
- `Keyboard` の `binding-picker-panel`: 既に `min-h-0 overflow-hidden` があるため、証拠なく変更しない。

変更した場合は、そのclassを既存 `BehaviorBindingPicker.test.tsx` または `Keyboard.loading.test.tsx` へ明示assertionとして追加し、同focused testsを再実行する。

- [ ] **Step 6: コミットする**

```bash
git add src/behaviors/picker/PickerTabs.tsx src/behaviors/picker/PickerTabs.test.tsx
git add src/behaviors/BehaviorBindingPicker.tsx src/behaviors/BehaviorBindingPicker.test.tsx src/keyboard/Keyboard.tsx src/keyboard/Keyboard.loading.test.tsx 2>/dev/null || true
git commit -m "fix: constrain key candidate scrolling"
```

Commit前に `git diff --cached --name-only` を確認し、実際に変更したproduction/testファイルだけがstageされていること。証拠なく変更していないoptional filesはstageされない。

---

### Task 4: Playwright二画面・全テスト・Tauri成果物の最終検証

**Files:**
- Modify: none
- Verify: `src/keyboard/KeyboardWorkspace.stories.tsx`
- Verify: `src/behaviors/picker/SystemTab.tsx`
- Verify: `src/behaviors/picker/PickerTabs.tsx`

**Interfaces:**
- Consumes: Tasks 1–3のStory IDs、test IDs、scroll/transparent契約。
- Produces: Vitest、lint、web build、Storybook build、Playwright 800×600/1200×800、Tauri buildのfresh evidence。

- [ ] **Step 1: focused testsをfresh実行する**

```bash
npm test -- src/behaviors/picker/SystemTab.test.tsx src/behaviors/picker/PickerTabs.test.tsx src/behaviors/BehaviorBindingPicker.test.tsx
```

Expected: 全件PASS。

- [ ] **Step 2: full Vitestを実行する**

```bash
npm test
```

Expected: exit 0、0 failures。`ErrorBoundary.test.tsx` が意図的に出すstack traceとVite deprecated warningは件数とともに記録する。

- [ ] **Step 3: lint、web build、Storybook buildを実行する**

```bash
npm run lint
npm run build
npm run build-storybook
git diff --check
```

Expected: 全てexit 0。既存chunk-size warningはUnknownではなくwarningとして記録する。

- [ ] **Step 4: Playwright helperで両Storyを検証する**

StorybookをHTTP 200になるまで起動し、次のhelperをCodex `node_repl` で実行する。

```js
async function verifySystemPicker(page, storyId, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(`http://127.0.0.1:6006/iframe.html?id=${storyId}&viewMode=story`);
  await page.getByRole("button", { name: "システム" }).click();

  var content = page.getByTestId("picker-tab-content");
  var footer = page.getByTestId("story-app-footer");
  var tabBar = page.getByTestId("picker-tab-bar");
  var keyboardGrid = page.getByRole("grid").first();
  var tabBarBefore = await tabBar.boundingBox();
  var keyboardBefore = await keyboardGrid.boundingBox();
  var firstTwo = await content.getByRole("button").evaluateAll((buttons) =>
    buttons.slice(0, 2).map((button) => button.textContent),
  );
  if (!firstTwo[0]?.startsWith("無効") || !firstTwo[1]?.startsWith("透過")) {
    throw new Error(`unexpected system order: ${firstTwo.join(" | ")}`);
  }

  var sizes = await content.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  if (sizes.scrollHeight <= sizes.clientHeight) throw new Error("system candidates are not scrollable");

  var last = page.getByRole("button", { name: /^BT プロファイル 2/ });
  await last.scrollIntoViewIfNeeded();
  var lastBox = await last.boundingBox();
  var contentBox = await content.boundingBox();
  var footerBox = await footer.boundingBox();
  if (
    !lastBox ||
    !contentBox ||
    lastBox.y < contentBox.y ||
    lastBox.y + lastBox.height > contentBox.y + contentBox.height - 8
  ) {
    throw new Error("last candidate is outside the candidate viewport");
  }
  if (!footerBox || lastBox.y + lastBox.height > footerBox.y - 8) {
    throw new Error("last candidate overlaps footer clearance");
  }

  var scrollTop = await content.evaluate((element) => element.scrollTop);
  if (scrollTop <= 0) throw new Error("scrollTop did not advance");

  await content.focus();
  await page.keyboard.press("Home");
  var homeScrollTop = await content.evaluate((element) => element.scrollTop);
  await page.keyboard.press("PageDown");
  var pageDownScrollTop = await content.evaluate((element) => element.scrollTop);
  if (homeScrollTop !== 0 || pageDownScrollTop <= homeScrollTop) {
    throw new Error("PageDown did not scroll the focused candidate viewport");
  }

  var tabBarAfter = await tabBar.boundingBox();
  var keyboardAfter = await keyboardGrid.boundingBox();
  var pageScrollY = await page.evaluate(() => window.scrollY);
  if (
    !tabBarBefore ||
    !tabBarAfter ||
    !keyboardBefore ||
    !keyboardAfter ||
    tabBarBefore.y !== tabBarAfter.y ||
    keyboardBefore.y !== keyboardAfter.y ||
    pageScrollY !== 0
  ) {
    throw new Error("candidate scrolling moved a fixed outer region");
  }

  await page.getByRole("button", { name: /^透過/ }).click();
  var current = await page.getByTestId("current-binding-feedback").textContent();
  if (!current?.includes("透過")) throw new Error("transparent assignment not reflected");
}

var pwFinal = await import("playwright");
var browserFinal = await pwFinal.chromium.launch({ headless: true });
var pageFinal = await browserFinal.newPage();
await verifySystemPicker(
  pageFinal,
  "keyboard-keyboardworkspace--integrated-system-picker-800x600",
  800,
  600,
);
await verifySystemPicker(
  pageFinal,
  "keyboard-keyboardworkspace--integrated-system-picker-1200x800",
  1200,
  800,
);
await browserFinal.close();
```

Expected: 2画面ともthrowなし。終了後、Storybook dev serverを停止し、port 6006がLISTENしていないことを確認する。

- [ ] **Step 5: Tauri production buildを実行する**

```bash
npm run tauri build
```

Expected: exit 0。`.app` と`.dmg`の実在・サイズを記録する。署名・notarization・実機起動を実施していない場合はUnknownのままにする。

- [ ] **Step 6: 最終scopeとworktreeを確認する**

```bash
git status --short
git diff --check
git diff --stat codex/implement-v060-editor-fixes..HEAD
git diff --name-only codex/implement-v060-editor-fixes..HEAD
```

Expected: tracked worktree clean。変更は設計/計画、Story、PickerTabs/SystemTabと対応tests、Task 3で実測根拠があった場合だけoptional祖先ファイル。Firmware/proto/RPC/package dependenciesに変更なし。
