# Binding Picker Vertical Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キー割当画面で候補部分だけを縦スクロールでき、タブを切り替えると候補先頭へ戻るようにする。

**Architecture:** `PickerTabs` のtab contentを唯一の縦scroll ownerにする。外枠の高さ配分とoverflow-hidden、タブ見出し、各tab componentは変えない。scroll位置はDOM refで即座に0へ戻し、smooth animationや新しいfocus stopは追加しない。

**Tech Stack:** React 18、TypeScript、Tailwind CSS、Vitest、Testing Library、Tauri 2

## Global Constraints

- 正本は `docs/superpowers/specs/2026-08-10-binding-picker-vertical-scroll-design.md`。検索、仮想化、カテゴリ再編、画面全体のlayout変更は追加しない。
- TDDのRED→GREENを守り、既存のtab、候補選択、修飾キー、layer、shortcutの挙動を維持する。
- scroll ownerは `data-testid="picker-tab-content"` の1箇所だけ。外枠、tab bar、各tab componentへ `overflow-y-auto` を足さない。
- `work/` と既存変更を保ち、記載ファイル以外をstageしない。

---

## Task 1: 候補contentを唯一の縦scroll ownerにする

**Files:**
- Modify: `src/behaviors/picker/PickerTabs.test.tsx`
- Modify: `src/behaviors/picker/PickerTabs.tsx`

- [ ] **Step 1: 不具合を固定している既存期待をRED testへ反転する**

`renders six tab buttons` 内の `not.toHaveClass("overflow-y-auto")` を削除し、次のcontractを期待する。

```ts
const content = screen.getByTestId("picker-tab-content");
expect(content).toHaveClass(
  "min-h-0",
  "flex-1",
  "overflow-y-auto",
  "overscroll-contain",
  "[scrollbar-gutter:stable]",
);
```

component rootとtab barを取得し、どちらも `overflow-y-auto` を持たないこともassertする。必要なtest idはrootに `picker-tabs`、tab barに `picker-tab-bar` を追加する前提でtestを書く。

- [ ] **Step 2: タブ切替でscrollTopが0になるRED testを書く**

```ts
const content = screen.getByTestId("picker-tab-content");
content.scrollTop = 120;
fireEvent.click(screen.getByRole("button", { name: "文字・記号" }));
expect(content.scrollTop).toBe(0);
expect(screen.getByText("文字・記号")).toBeDefined();
```

`fireEvent` をTesting Library importへ追加する。先頭と最後の候補が同じcontent panelの子孫に存在するfixtureも追加し、候補を切り捨てる条件renderがないことを固定する。

- [ ] **Step 3: REDを確認する**

Run: `npm test -- src/behaviors/picker/PickerTabs.test.tsx`

Expected: contentにoverflow classがなく、tab切替後もscrollTop=120のため失敗。

- [ ] **Step 4: `PickerTabs` にrefと単一scroll ownerを実装する**

importを次へ変更する。

```ts
import { useRef, useState } from "react";
```

component内へ次を追加する。

```ts
const contentRef = useRef<HTMLDivElement>(null);

function selectTab(tabId: TabId) {
  if (contentRef.current) contentRef.current.scrollTop = 0;
  setActiveTab(tabId);
}
```

各buttonは `onClick={() => selectTab(tab.id)}` を使う。DOM contractは次に固定する。

```tsx
<div data-testid="picker-tabs" className="flex min-h-0 flex-1 flex-col gap-1.5">
  <div data-testid="picker-tab-bar" className="flex gap-0.5 overflow-x-auto rounded-lg bg-base-200 p-0.5">
    {/* existing buttons */}
  </div>
  <div
    ref={contentRef}
    data-testid="picker-tab-content"
    className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
  >
    {/* existing tab content */}
  </div>
</div>
```

- [ ] **Step 5: focused testをGREENにする**

Run: `npm test -- src/behaviors/picker/PickerTabs.test.tsx`

Expected: exit 0。

- [ ] **Step 6: picker回帰testを実行する**

Run: `npm test -- src/behaviors/picker`

Expected: picker配下の9 suiteがすべてexit 0。

- [ ] **Step 7: 変更をcommitする**

```bash
git add src/behaviors/picker/PickerTabs.tsx src/behaviors/picker/PickerTabs.test.tsx
git commit -m "fix: scroll key binding candidates vertically"
```

## Task 2: 全自動検証と画面操作を確認する

**Files:**
- Verify only; visual mismatch requires a failing contract test before code changes where testable.

- [ ] **Step 1: 全test、lint、web buildを個別に実行する**

```bash
npm test
npm run lint
npm run build
```

Expected: 3件ともexit 0。

- [ ] **Step 2: Tauri buildを実行する**

Run: `npm run tauri build`

Expected: exit 0。

- [ ] **Step 3: dev serverで2画面サイズを確認する**

Run: `npm run dev`

800×600と1200×800でキー割当画面を開き、候補contentだけに縦scrollbarが出ること、tab barが残ること、横scrollbarと二重縦scrollがないことを確認する。確認後Ctrl-Cで終了する。

- [ ] **Step 4: 入力手段ごとの到達性を確認する**

Macのmouse wheel、trackpad、Tabキーで最後の候補まで到達し、候補を選べることを確認する。tabを切り替えるたび新カテゴリが先頭から表示され、割当済みbindingと選択tab以外の状態が変わらないことを確認する。touch環境がなければ、touchは未確認と明記し、browser標準overflow contractの自動test結果と分けて報告する。
