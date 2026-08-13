# App Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の静止UIを維持したまま、アプリ全体の押下、画面切替、選択確定、保存成功、モーダルに一貫した短いモーションを追加する。

**Architecture:** モーションの数値と共通セレクタは `src/motion/motion.css` に集約し、React は `data-motion-state` で画面切替や非同期処理の結果だけを伝える。トップレベルタブの選択ピルは専用hookで位置と幅を測定し、成功フィードバックとダイアログ退場も小さな独立ユーティリティとして実装する。

**Tech Stack:** React 18、TypeScript、Tailwind CSS、React Aria、Vitest、Testing Library、Tauri 2。新しい依存ライブラリは追加しない。

## Global Constraints

- 静止時の配色、余白、タイポグラフィ、画面構成を変更しない。
- 押下は90ms、復帰は120ms、画面入場は160ms、選択確定は180〜220ms、モーダル入場は200ms、退場は140msとする。
- 入場は `cubic-bezier(0, 0, 0.2, 1)`、状態変化は `cubic-bezier(0.4, 0, 0.2, 1)` を使う。
- 移動量は通常4px以下、押下は `translateY(1px) scale(0.98)` とする。
- `transition-all` を新規追加せず、動かすCSSプロパティを明示する。
- `prefers-reduced-motion: reduce` では移動と拡大を止め、80ms以下の色・透明度変化だけを残す。
- 成功演出は通信またはreadback成功後だけ出し、要求送信時や失敗時には出さない。
- アニメーション完了を次の操作の条件にしない。
- ファームウェア、RPC、保存形式には触れない。
- メインcheckoutの既存 `.gitignore` と `work/` は変更しない。

---

### Task 1: モーション基盤と通知のアクセシビリティ

**Files:**
- Create: `src/motion/motion.css`
- Create: `src/motion/useTransientFeedback.ts`
- Create: `src/motion/useTransientFeedback.test.tsx`
- Create: `src/style/motionAccessibility.test.ts`
- Create: `src/misc/Toast.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/misc/Toast.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `useTransientFeedback(durationMs?: number): { active: boolean; trigger(): void }`
- Produces: `data-motion-state="enter|confirmed|closing"` を描画する共通CSS規則。
- Produces: 成功通知は `role="status" aria-live="polite"`、エラー通知は `role="alert"`。

- [ ] **Step 1: 一時フィードバックhookの失敗テストを書く**

```tsx
function Harness() {
  const feedback = useTransientFeedback(220);
  return (
    <button data-motion-state={feedback.active ? "confirmed" : undefined} onClick={feedback.trigger}>
      確定
    </button>
  );
}

it("activates immediately and clears after the requested duration", () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "確定" }));
  expect(screen.getByRole("button")).toHaveAttribute("data-motion-state", "confirmed");
  act(() => vi.advanceTimersByTime(220));
  expect(screen.getByRole("button")).not.toHaveAttribute("data-motion-state");
});
```

`motionAccessibility.test.ts` では `motion.css` を `readFileSync` し、`@media (prefers-reduced-motion: reduce)`、6個のduration token、reduced motion内の `transform: none` が存在することを文字列で固定する。

- [ ] **Step 2: Toastの失敗テストを書く**

```tsx
function ToastHarness() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast("保存しました", "success")}>成功</button>
      <button onClick={() => toast("保存できませんでした", "error")}>失敗</button>
    </>
  );
}

it("announces success politely and errors assertively", () => {
  render(<ToastProvider><ToastHarness /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "成功" }));
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("status")).toHaveAttribute("data-motion-state", "enter");
  fireEvent.click(screen.getByRole("button", { name: "失敗" }));
  expect(screen.getByRole("alert")).toHaveTextContent("保存できませんでした");
});
```

- [ ] **Step 3: focused testがREDになることを確認する**

Run: `npm test -- src/motion/useTransientFeedback.test.tsx src/misc/Toast.test.tsx src/style/motionAccessibility.test.ts`

Expected: `useTransientFeedback` と Toast のARIA属性が未実装のためFAIL。

- [ ] **Step 4: hookを最小実装する**

```ts
export function useTransientFeedback(durationMs = 220) {
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActive(true);
    timeoutRef.current = setTimeout(() => setActive(false), durationMs);
  }, [durationMs]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { active, trigger };
}
```

- [ ] **Step 5: 共通CSSとToastを実装する**

`motion.css` に `--motion-press: 90ms`、`--motion-return: 120ms`、`--motion-view: 160ms`、`--motion-confirm: 220ms`、`--motion-dialog-in: 200ms`、`--motion-dialog-out: 140ms` を定義する。全buttonの `:active` とReact Ariaの `[data-pressed]` に押下transformを適用し、disabled要素は除外する。`.keycap` は選択時の既存scaleを保つ専用押下値にする。

`Toast.tsx` では `Check`、`CircleAlert`、`Info` を種類別に表示し、成功・infoには `role="status" aria-live="polite"`、errorには `role="alert"` を付ける。既存の3秒自動削除とメッセージ色は変更しない。`main.tsx` で `index.css` の直後に `motion.css` をimportし、`index.css` の旧 `.animate-fade-in` はToast移行後に削除する。

- [ ] **Step 6: focused testをGREENにする**

Run: `npm test -- src/motion/useTransientFeedback.test.tsx src/misc/Toast.test.tsx src/style/motionAccessibility.test.ts`

Expected: 追加した全テストがPASS。

- [ ] **Step 7: 基盤をコミットする**

```bash
git add src/main.tsx src/index.css src/motion/motion.css src/motion/useTransientFeedback.ts src/motion/useTransientFeedback.test.tsx src/style/motionAccessibility.test.ts src/misc/Toast.tsx src/misc/Toast.test.tsx
git commit -m "feat: add shared app motion primitives"
```

---

### Task 2: トップレベル画面と編集モードの遷移

**Files:**
- Create: `src/navigation/useSlidingTabIndicator.ts`
- Create: `src/navigation/useSlidingTabIndicator.test.tsx`
- Create: `src/navigation/StudioTabView.test.tsx`
- Modify: `src/navigation/StudioTabView.tsx`
- Modify: `src/keyboard/KeyboardWorkspace.tsx`
- Modify: `src/keyboard/KeyboardWorkspace.test.tsx`

**Interfaces:**
- Consumes: Task 1の `data-motion-state="enter"` と `.motion-tab-indicator`。
- Produces: `useSlidingTabIndicator<T extends string>(activeId: T)`。戻り値は `containerRef`、`registerItem(id)`、`indicatorStyle: { left: number; width: number } | null`。
- Produces: トップレベル内容領域の `data-motion-view={activeTab}` と、編集／リアルタイム領域の `data-motion-state="enter"`。

- [ ] **Step 1: 選択ピル位置計算の失敗テストを書く**

```tsx
function Harness({ active }: { active: "a" | "b" }) {
  const indicator = useSlidingTabIndicator(active);
  return (
    <nav ref={indicator.containerRef} data-testid="nav">
      <button ref={indicator.registerItem("a")}>A</button>
      <button ref={indicator.registerItem("b")}>B</button>
      <output data-testid="indicator">{JSON.stringify(indicator.indicatorStyle)}</output>
    </nav>
  );
}

it("measures the active item relative to its container and updates on resize", () => {
  let bLeft = 90;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    const label = this.textContent;
    const left = label === "B" ? bLeft : label === "A" ? 20 : 10;
    const width = label === "B" ? 70 : label === "A" ? 60 : 200;
    return {
      x: left, y: 0, left, top: 0, width, height: 40,
      right: left + width, bottom: 40, toJSON: () => ({}),
    };
  });
  render(<Harness active="b" />);
  expect(screen.getByTestId("indicator")).toHaveTextContent('{"left":80,"width":70}');
  bLeft = 100;
  fireEvent(window, new Event("resize"));
  expect(screen.getByTestId("indicator")).toHaveTextContent('{"left":90,"width":70}');
});
```

- [ ] **Step 2: 画面遷移の失敗テストを書く**

```tsx
it("keeps navigation fixed and marks only the active content as entering", () => {
  const { rerender } = render(
    <StudioTabView activeTab="keymap" onSelectTab={() => {}} renderTab={(tab) => <p>{tab}</p>} />,
  );
  expect(screen.getByTestId("studio-tab-content")).toHaveAttribute("data-motion-state", "enter");
  rerender(<StudioTabView activeTab="combo" onSelectTab={() => {}} renderTab={(tab) => <p>{tab}</p>} />);
  expect(screen.getByTestId("studio-tab-content")).toHaveAttribute("data-motion-view", "combo");
  expect(screen.getByTestId("studio-tab-indicator")).toBeInTheDocument();
});
```

`KeyboardWorkspace.test.tsx` には、編集→リアルタイム→編集の各可視領域が `data-motion-state="enter"` になり、既存の編集メモが保持される検証を追加する。

- [ ] **Step 3: focused testがREDになることを確認する**

Run: `npm test -- src/navigation/useSlidingTabIndicator.test.tsx src/navigation/StudioTabView.test.tsx src/keyboard/KeyboardWorkspace.test.tsx`

Expected: hook、indicator、motion属性が存在しないためFAIL。

- [ ] **Step 4: 選択ピルhookを実装する**

`useLayoutEffect` でcontainerとactive buttonの `getBoundingClientRect()` を読み、`left = item.left - container.left`、`width = item.width` を保存する。active ID変更時と `window.resize` 時に再計測し、cleanupでlistenerを外す。要素未登録または幅0の時は `null` を返し、画面切替を止めない。

- [ ] **Step 5: StudioTabViewへ固定ナビゲーションと内容入場を実装する**

`nav` を `relative` にし、タブ群より前に `aria-hidden="true"` のindicatorを置く。active buttonの既存背景色はindicatorへ移し、文字とアイコンは `relative z-10` で表示する。内容は次の形にする。

```tsx
<div
  key={activeTab}
  data-testid="studio-tab-content"
  data-motion-view={activeTab}
  data-motion-state="enter"
  className="h-full min-h-0 overflow-hidden"
>
  {renderTab(activeTab)}
</div>
```

- [ ] **Step 6: KeyboardWorkspaceの状態保持を壊さず入場属性を付ける**

editor DOMは現在どおりmountしたまま `hidden` で切り替える。表示側だけ `data-motion-state="enter"` を持ち、mode変更で属性が付け直されるよう `data-motion-view={mode}` を付ける。モニター未接続時のdisabled条件は変更しない。

- [ ] **Step 7: focused testをGREENにする**

Run: `npm test -- src/navigation/useSlidingTabIndicator.test.tsx src/navigation/StudioTabView.test.tsx src/keyboard/KeyboardWorkspace.test.tsx src/navigation/StudioSessionNavigation.test.tsx`

Expected: 全テストPASS。既存のdirty保存後ナビゲーションもPASS。

- [ ] **Step 8: 画面遷移をコミットする**

```bash
git add src/navigation/useSlidingTabIndicator.ts src/navigation/useSlidingTabIndicator.test.tsx src/navigation/StudioTabView.tsx src/navigation/StudioTabView.test.tsx src/keyboard/KeyboardWorkspace.tsx src/keyboard/KeyboardWorkspace.test.tsx
git commit -m "feat: animate stable workspace transitions"
```

---

### Task 3: キー割当ての押下と選択確定

**Files:**
- Create: `src/behaviors/BehaviorBindingPicker.test.tsx`
- Modify: `src/behaviors/BehaviorBindingPicker.tsx`
- Modify: `src/behaviors/picker/PickerTabs.tsx`
- Modify: `src/behaviors/picker/PickerTabs.test.tsx`
- Modify: `src/behaviors/picker/ActionsTab.tsx`
- Modify: `src/behaviors/picker/ActionsTab.test.tsx`
- Modify: `src/behaviors/picker/LettersTab.tsx`
- Modify: `src/behaviors/picker/LettersTab.test.tsx`
- Modify: `src/keyboard/Key.tsx`
- Modify: `src/keyboard/key-presentation.test.tsx`

**Interfaces:**
- Consumes: Task 1の `useTransientFeedback(220)` と共通button押下CSS。
- Produces: `BehaviorBindingPicker` の現在設定帯に `data-motion-state="confirmed"`。
- Produces: picker内容に `data-motion-state="enter"`、候補buttonに `data-motion-kind="choice"`。

- [ ] **Step 1: 現在設定の確定フィードバック失敗テストを書く**

```tsx
it("pulses the current setting only after a choice is applied", () => {
  vi.useFakeTimers();
  const onBindingChanged = vi.fn();
  render(
    <OsModeProvider>
      <BehaviorBindingPicker
        binding={{ behaviorId: 10, param1: 4, param2: 0 }}
        behaviors={[{ id: 10, displayName: "Key Press", metadata: [] }]}
        layers={[{ id: 0, index: 0, name: "Base" }]}
        onBindingChanged={onBindingChanged}
      />
    </OsModeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "文字・記号" }));
  fireEvent.click(screen.getByRole("button", { name: "A" }));
  expect(screen.getByTestId("current-binding-feedback")).toHaveAttribute("data-motion-state", "confirmed");
  expect(onBindingChanged).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(220));
  expect(screen.getByTestId("current-binding-feedback")).not.toHaveAttribute("data-motion-state");
});
```

- [ ] **Step 2: pickerタブと候補の失敗テストを書く**

`PickerTabs.test.tsx` に、文字・記号へ切り替えるとcontentが `data-motion-state="enter" data-motion-view="letters"` になり、既存どおりscrollTopが0へ戻る検証を追加する。

`ActionsTab.test.tsx` と `LettersTab.test.tsx` では候補buttonが `data-motion-kind="choice"` を持ち、クリック後も `onApplyBinding` のpayloadが変わらないことを固定する。

`key-presentation.test.tsx` では有効なキーキャップに `keycap` と `data-motion-kind="keycap"`、disabledキーに `disabled` が残ることを検証する。

- [ ] **Step 3: focused testがREDになることを確認する**

Run: `npm test -- src/behaviors/BehaviorBindingPicker.test.tsx src/behaviors/picker/PickerTabs.test.tsx src/behaviors/picker/ActionsTab.test.tsx src/behaviors/picker/LettersTab.test.tsx src/keyboard/key-presentation.test.tsx`

Expected: motion属性と確定タイマーが未実装のためFAIL。

- [ ] **Step 4: BehaviorBindingPickerの確定パルスを実装する**

`handleApplyBinding` 内でmodifier適用後に `onBindingChangedRef.current(applied)` を呼び、その直後に `feedback.trigger()` を呼ぶ。現在設定帯へ `data-motion-state={feedback.active ? "confirmed" : undefined}` を付ける。保存済みを意味する文言は追加せず、draftへの割当て確定として扱う。

- [ ] **Step 5: picker内容と候補へ共通属性を付ける**

`PickerTabs` のcontentをactiveTabごとにkey付き内側divで包み、`data-motion-state="enter" data-motion-view={activeTab}` を付ける。既存のscroll container自体はmountしたままにし、縦スクロール修正を維持する。ActionsとLettersの候補buttonへ `data-motion-kind="choice"` を付ける。

- [ ] **Step 6: Keyの既存hoverを落ち着かせる**

未選択キーのhoverを `scale-105 -translate-y-0.5` から `scale-[1.02] -translate-y-px` に変更する。`transition-all` を `transition-[transform,box-shadow,border-color,background-color]` へ置換し、`data-motion-kind="keycap"` を付ける。選択ring、tooltip、`aria-pressed` は維持する。

- [ ] **Step 7: focused testをGREENにする**

Run: `npm test -- src/behaviors/BehaviorBindingPicker.test.tsx src/behaviors/picker/PickerTabs.test.tsx src/behaviors/picker/ActionsTab.test.tsx src/behaviors/picker/LettersTab.test.tsx src/keyboard/key-presentation.test.tsx`

Expected: 全テストPASS。

- [ ] **Step 8: キー割当ての手応えをコミットする**

```bash
git add src/behaviors/BehaviorBindingPicker.tsx src/behaviors/BehaviorBindingPicker.test.tsx src/behaviors/picker/PickerTabs.tsx src/behaviors/picker/PickerTabs.test.tsx src/behaviors/picker/ActionsTab.tsx src/behaviors/picker/ActionsTab.test.tsx src/behaviors/picker/LettersTab.tsx src/behaviors/picker/LettersTab.test.tsx src/keyboard/Key.tsx src/keyboard/key-presentation.test.tsx
git commit -m "feat: add tactile key assignment feedback"
```

---

### Task 4: 保存成功フィードバックの共通部品

**Files:**
- Create: `src/motion/ActionFeedbackLabel.tsx`
- Create: `src/motion/ActionFeedbackLabel.test.tsx`
- Create: `src/AppHeader.test.tsx`
- Modify: `src/AppHeader.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.disconnected.test.tsx`
- Modify: `src/combos/ComboSettings.tsx`
- Modify: `src/combos/ComboSettings.test.tsx`
- Modify: `src/trackball/TrackballPrecisionSettings.tsx`
- Modify: `src/trackball/TrackballPrecisionSettings.test.tsx`

**Interfaces:**
- Consumes: Task 1の `useTransientFeedback(800)`。
- Produces: `ActionFeedbackLabel({ idleLabel, pendingLabel, successLabel, pending, success }): ReactNode`。
- Produces: `AppHeaderProps.onSave?: () => Promise<boolean>`。
- Produces: device-infoまで完了した接続だけを通知する成功Toast「キーボードに接続しました」。

- [ ] **Step 1: 共通ラベルの失敗テストを書く**

```tsx
it("shows a decorative check only for confirmed success", () => {
  const { rerender } = render(
    <ActionFeedbackLabel idleLabel="保存" pendingLabel="保存中…" successLabel="保存済み" pending={false} success={false} />,
  );
  expect(screen.getByText("保存")).toBeInTheDocument();
  rerender(<ActionFeedbackLabel idleLabel="保存" pendingLabel="保存中…" successLabel="保存済み" pending={false} success />);
  expect(screen.getByText("保存済み")).toBeInTheDocument();
  expect(screen.getByTestId("action-success-icon")).toHaveAttribute("aria-hidden", "true");
});
```

- [ ] **Step 2: ヘッダー保存の成功・失敗テストを書く**

`AppHeader.test.tsx` で `onSave` がresolve trueした場合だけ800ms「保存済み」を表示し、rejectした場合は「保存」のままであることをfake timerで検証する。テストは必要なConnection、LockState、OsMode contextと `useConnectedDeviceData` mockを用意する。

- [ ] **Step 3: Comboと精密モード保存の失敗テストを書く**

既存テストへ、readback一致後はbuttonが「保存済み」、`success=false`、timeout、readback mismatchでは一度も「保存済み」にならない検証を加える。`TrackballPrecisionSettings` は `save()` がtrueの時だけ「保存済み」、falseでは「保存」のままとする。

`App.disconnected.test.tsx` には、`create_rpc_connection` と `requestDeviceInfo` がresolveした時だけ「キーボードに接続しました」のsuccess Toastが表示され、既存device-info失敗では表示されないケースを追加する。

- [ ] **Step 4: focused testがREDになることを確認する**

Run: `npm test -- src/motion/ActionFeedbackLabel.test.tsx src/AppHeader.test.tsx src/App.disconnected.test.tsx src/combos/ComboSettings.test.tsx src/trackball/TrackballPrecisionSettings.test.tsx`

Expected: 共通ラベルと成功状態が未実装のためFAIL。

- [ ] **Step 5: ActionFeedbackLabelとヘッダー保存を実装する**

`ActionFeedbackLabel` はpendingをsuccessより優先し、success時だけ `Check` を表示する。3つのlabelは同じCSS grid cellへ重ね、非表示labelを `visibility: hidden` で残して最大幅を維持する。`AppHeader` は `handleSave` 内で `await onSave()` を実行し、戻り値がtrueの時だけ `feedback.trigger()` を呼ぶ。例外は既存 `save()` がエラーToastを表示した後に `handleSave` で捕捉し、未処理Promiseにしない。React Ariaへは `onPress={() => void handleSave()}` を渡す。`App.tsx` は例外を握りつぶすwrapperを外し、`onSave={save}` を渡す。

`App.tsx` の `onConnect` は `await connect(...)` がdevice-info取得まで完了した直後に `toast("キーボードに接続しました", "success")` を呼ぶ。接続失敗、device-info失敗、切断処理では呼ばない。

- [ ] **Step 6: Comboと精密モードへ明示成功を接続する**

`ComboSettings.handleSave` はRPC successとGetAll readback一致後、既存success toastの直前にfeedbackをtriggerする。`TrackballPrecisionSettings.SaveButton` は `const saved = await save()` がtrueの時だけtriggerする。pending中は既存の「保存中…」を表示し、成功表示は800ms後に「保存」へ戻す。

- [ ] **Step 7: focused testをGREENにする**

Run: `npm test -- src/motion/ActionFeedbackLabel.test.tsx src/AppHeader.test.tsx src/App.disconnected.test.tsx src/combos/ComboSettings.test.tsx src/trackball/TrackballPrecisionSettings.test.tsx`

Expected: 全テストPASS。失敗ケースに成功表示なし。

- [ ] **Step 8: 保存成功部品をコミットする**

```bash
git add src/motion/ActionFeedbackLabel.tsx src/motion/ActionFeedbackLabel.test.tsx src/AppHeader.tsx src/AppHeader.test.tsx src/App.tsx src/App.disconnected.test.tsx src/combos/ComboSettings.tsx src/combos/ComboSettings.test.tsx src/trackball/TrackballPrecisionSettings.tsx src/trackball/TrackballPrecisionSettings.test.tsx
git commit -m "feat: confirm successful save actions"
```

---

### Task 5: 残りの主要設定画面へ成功フィードバックを展開

**Files:**
- Modify: `src/trackball/TrackballSettings.tsx`
- Modify: `src/trackball/TrackballSettings.test.tsx`
- Modify: `src/holdtap/HoldTapSettings.tsx`
- Modify: `src/holdtap/HoldTapSettings.test.tsx`
- Modify: `src/encoder/EncoderSettings.tsx`
- Modify: `src/encoder/EncoderSettings.test.tsx`
- Modify: `src/settings/DeviceSettings.tsx`
- Create: `src/settings/DeviceSettings.test.tsx`
- Modify: `src/bluetooth/BleManagement.tsx`
- Modify: `src/bluetooth/BleManagement.test.tsx`

**Interfaces:**
- Consumes: Task 1の `useTransientFeedback(800)`。
- Consumes: Task 4の `ActionFeedbackLabel`。
- Produces: Trackball「適用済み」、Hold-Tap「適用済み」、Encoder「保存済み」、Device「適用済み」の明示成功状態。
- Produces: Bluetooth名保存の成功時だけ表示される成功Toast「プロファイル名を保存しました」。

- [ ] **Step 1: 各画面の成功・失敗テストを先に追加する**

各既存テストの成功fixtureでは、処理完了後にbuttonのaccessible nameが次の値になることを確認する。

```text
TrackballSettings: 適用済み
HoldTapSettings: 適用済み
EncoderSettings: 保存済み
DeviceSettings: 適用済み
```

各画面の既存失敗fixtureでは、成功文言が表示されないことを確認する。DeviceSettingsにテストがないため、success responseとrejected responseを返すRPC mockを持つfocused testを新設する。BleManagementはprofile name RPCとrefreshが両方resolveした時だけ `toast("プロファイル名を保存しました", "success")`、どちらかがrejectした時は既存error Toastだけになることを検証する。

- [ ] **Step 2: focused testがREDになることを確認する**

Run: `npm test -- src/trackball/TrackballSettings.test.tsx src/holdtap/HoldTapSettings.test.tsx src/encoder/EncoderSettings.test.tsx src/settings/DeviceSettings.test.tsx src/bluetooth/BleManagement.test.tsx`

Expected: 成功ラベルが未実装のためFAIL。

- [ ] **Step 3: 各handlerの確定成功地点でtriggerする**

Trackballは `handleApply()` がtrueを返した時、Hold-Tapは変更対象の全RPCと一覧再取得が例外なく完了した時、Encoderは時計回り・反時計回り両方の明示successと一覧再取得完了後、Deviceはsetと再取得が両方resolveした時にだけ `feedback.trigger()` を呼ぶ。catch、false response、timeoutでは呼ばない。Bluetooth名はsetとprofile再取得が両方resolveした後にsuccess Toastを出し、編集欄を閉じる。各ボタンのpending・disabled条件は変更しない。

- [ ] **Step 4: ActionFeedbackLabelへ既存文言を移す**

Trackball、Hold-Tap、Encoder、Deviceのprimary buttonの文字を `ActionFeedbackLabel` へ置換する。pending labelは各ファイルに現在ある「適用中...」「保存中...」表記をそのまま渡し、success labelはTrackball・Hold-Tap・Deviceが「適用済み」、Encoderが「保存済み」とする。初期化、削除、ペア解除、破棄には成功チェックを付けない。

- [ ] **Step 5: focused testをGREENにする**

Run: `npm test -- src/trackball/TrackballSettings.test.tsx src/holdtap/HoldTapSettings.test.tsx src/encoder/EncoderSettings.test.tsx src/settings/DeviceSettings.test.tsx src/bluetooth/BleManagement.test.tsx`

Expected: 成功・失敗の両経路がPASS。

- [ ] **Step 6: 設定画面展開をコミットする**

```bash
git add src/trackball/TrackballSettings.tsx src/trackball/TrackballSettings.test.tsx src/holdtap/HoldTapSettings.tsx src/holdtap/HoldTapSettings.test.tsx src/encoder/EncoderSettings.tsx src/encoder/EncoderSettings.test.tsx src/settings/DeviceSettings.tsx src/settings/DeviceSettings.test.tsx src/bluetooth/BleManagement.tsx src/bluetooth/BleManagement.test.tsx
git commit -m "feat: unify settings success feedback"
```

---

### Task 6: モーダルの共通入退場

**Files:**
- Create: `src/misc/dialogMotion.ts`
- Create: `src/misc/dialogMotion.test.ts`
- Create: `src/misc/useModalRef.test.tsx`
- Modify: `src/misc/useModalRef.ts`
- Modify: `src/GenericModal.tsx`
- Modify: `src/navigation/UnsavedChangesDialog.tsx`
- Modify: `src/navigation/UnsavedChangesDialog.test.tsx`

**Interfaces:**
- Consumes: Task 1のdialog motion CSS。
- Produces: `closeDialogWithMotion(dialog: HTMLDialogElement, durationMs?: number): () => void`。140ms後または`animationend`の早い方で一度だけ `dialog.close()` し、戻り値でpending closeを取消できる。
- Preserves: `useModalRef(open, closeOnOutsideClick?, allowCancel?)` の公開signature。

- [ ] **Step 1: dialog close helperの失敗テストを書く**

```ts
it("marks the dialog closing and closes it once after 140ms", () => {
  vi.useFakeTimers();
  const dialog = document.createElement("dialog");
  dialog.close = vi.fn();
  Object.defineProperty(dialog, "open", { configurable: true, value: true });
  const cancel = closeDialogWithMotion(dialog, 140);
  expect(dialog).toHaveAttribute("data-motion-state", "closing");
  vi.advanceTimersByTime(140);
  expect(dialog.close).toHaveBeenCalledOnce();
  cancel();
});
```

- [ ] **Step 2: hookと未保存dialogの失敗テストを書く**

`useModalRef.test.tsx` ではopen trueで `showModal()` が呼ばれ `data-motion-state="enter"`、open falseへのrerender直後はcloseされず、140ms後にcloseされることを確認する。outside clickと許可されたEscape cancelも同じhelperを通ることを固定する。

`UnsavedChangesDialog.test.tsx` ではoverlayとsectionがそれぞれmotion属性を持ち、既存3操作が1回ずつ発火することを確認する。

- [ ] **Step 3: focused testがREDになることを確認する**

Run: `npm test -- src/misc/dialogMotion.test.ts src/misc/useModalRef.test.tsx src/navigation/UnsavedChangesDialog.test.tsx`

Expected: close helperとmotion属性が未実装のためFAIL。

- [ ] **Step 4: animationendとtimeoutの二重closeを防ぐhelperを実装する**

`closeDialogWithMotion` は完了フラグを持ち、`animationend` listenerを `{ once: true }` で登録する。同時に140ms fallback timerを設定し、どちらかが完了したらlistenerとtimerを解除して `dialog.close()` を一度だけ呼ぶ。戻り値のcancel関数はlistenerとtimerを解除し、`closing` 属性を外す。dialogが既にclosedなら何もしないcancel関数を返す。

- [ ] **Step 5: useModalRefを入退場対応にする**

open時は `showModal()` 後に `data-motion-state="enter"` を付ける。open false、outside click、allowCancelがfalseでないcancelは `preventDefault()` してclose helperを呼ぶ。allowCancel falseのcancelは現在どおり閉じず、再open timeoutも残さない。effect cleanupでdocument listenerとpending closeを解除する。

- [ ] **Step 6: GenericModalと未保存dialogへ共通属性を付ける**

GenericModalのdialogへ `data-motion-kind="dialog"` を付け、backdropはCSSでフェードする。UnsavedChangesDialogはnative dialogではないため、overlayへ `data-motion-kind="dialog-backdrop"`、sectionへ `data-motion-kind="dialog" data-motion-state="enter"` を付ける。未保存dialogは親の即時unmountを維持し、退場は適用せず入場だけ共通化する。

- [ ] **Step 7: focused testをGREENにする**

Run: `npm test -- src/misc/dialogMotion.test.ts src/misc/useModalRef.test.tsx src/navigation/UnsavedChangesDialog.test.tsx src/ConnectModal.test.tsx`

Expected: 全テストPASS。接続modalの開閉回帰もPASS。

- [ ] **Step 8: モーダル遷移をコミットする**

```bash
git add src/misc/dialogMotion.ts src/misc/dialogMotion.test.ts src/misc/useModalRef.ts src/misc/useModalRef.test.tsx src/GenericModal.tsx src/navigation/UnsavedChangesDialog.tsx src/navigation/UnsavedChangesDialog.test.tsx
git commit -m "feat: animate modal entry and exit"
```

---

### Task 7: 全体回帰・アクセシビリティ・実画面確認

**Files:**
- Modify only if a verification failure identifies a scoped defect in files changed by Tasks 1–6.

**Interfaces:**
- Consumes: Tasks 1–6の完成状態。
- Produces: 自動テスト、静的検査、Web build、Tauri build、目視確認の証拠。

- [ ] **Step 1: motion対象のfocused suiteをまとめて実行する**

Run:

```bash
npm test -- \
  src/motion/useTransientFeedback.test.tsx \
  src/motion/ActionFeedbackLabel.test.tsx \
  src/misc/Toast.test.tsx \
  src/navigation/useSlidingTabIndicator.test.tsx \
  src/navigation/StudioTabView.test.tsx \
  src/keyboard/KeyboardWorkspace.test.tsx \
  src/behaviors/BehaviorBindingPicker.test.tsx \
  src/behaviors/picker/PickerTabs.test.tsx \
  src/keyboard/key-presentation.test.tsx \
  src/misc/dialogMotion.test.ts \
  src/misc/useModalRef.test.tsx
```

Expected: exit 0、全テストPASS。

- [ ] **Step 2: 全自動検証を実行する**

Run: `npm test`

Expected: exit 0。既存634件に追加テストを加えた全suiteがPASS。

Run: `npm run lint`

Expected: exit 0、warning 0。

Run: `npm run build`

Expected: exit 0。既存のchunk size warningは失敗扱いにしないが、新しいwarningは残さない。

Run: `npm run tauri build`

Expected: exit 0。macOS `.app` と `.dmg` が生成される。Apple認証情報がない場合のnotarization未実施は別途明記する。

- [ ] **Step 3: 開発サーバーとStorybookで目視確認する**

Run: `npm run dev -- --host 127.0.0.1`

確認項目:

1. トップレベル8タブで外枠が固定され、内容だけ160msで入る。
2. 編集／リアルタイム切替で編集内容が保持される。
3. キーと候補が押下時に1px沈み、連続割当てでも確定パルスが邪魔にならない。
4. 保存失敗ではチェックが出ず、成功時だけ800ms表示される。
5. modalが200msで入り、閉じる操作が140msを超えて待たされない。
6. 800×600でタブ、候補、Toast、modalが切れない。

- [ ] **Step 4: reduced motionを目視確認する**

macOSの「視差効果を減らす」を有効にするか、ブラウザ開発ツールで `prefers-reduced-motion: reduce` をemulateする。画面移動、scale、選択ピルの滑走が止まり、色・透明度だけで状態が分かることを確認する。フォーカスリングとキーボード操作が維持されることも確認する。

- [ ] **Step 5: 差分の安全性を確認する**

Run: `git diff --check HEAD~6..HEAD`

Expected: outputなし、exit 0。

Run: `git status --short`

Expected: outputなし。失敗修正が必要だった場合は、該当Taskのファイルだけを直し、focused test→全testの順で再実行して次のcommitを作る。

---

## 完了判定

- 全主要button、React Aria Button、キーキャップに一貫した押下感がある。
- トップレベルタブと編集／リアルタイム切替で、固定フレーム内の内容だけが遷移する。
- 保存・適用は明示成功後だけ成功表示になり、失敗時のdraft保持を壊さない。
- native dialogは入退場、未保存dialogは入場モーションを持つ。
- reduced motion、ARIA通知、キーボードフォーカスが機能する。
- `npm test`、`npm run lint`、`npm run build`、`npm run tauri build` がexit 0。
