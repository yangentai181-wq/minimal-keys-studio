# Trackball Gesture Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** I+Oで切り替える4方向トラックボールジェスチャーと、既存ピッカーで編集できるStudio設定画面を追加する。

**Architecture:** Firmwareは固定commitの`zmk-mouse-gesture`で方向を認識し、予約Gesture Layer index 9の4 bindingを小さな`gesture_slot` behavior経由で実行する。Studioは専用RPCを追加せず、既存keymap RPC、Undo/Redo、Save/Discard、`BehaviorBindingPicker`を再利用する。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Tauri 2、ZMK/Zephyr Devicetree、C、Python unittest

**Spec:** `docs/superpowers/specs/2026-08-24-trackball-gesture-shortcuts-design.md`

## Global Constraints

- `I` position 7と`O` position 8の同時押しごとにジェスチャーモードをON/OFFする。
- Gesture Layerは固定index 9、方向slotは上7・左18・右20・下31とする。
- `zmk-mouse-gesture`はcommit `62f3c9d8ca6763e160b73efc46108c61dd0243a0`へ固定し、MITライセンスと適用範囲を記録する。
- 新しいStudio RPC、proto、ブラウザー永続化、デバイス別設定を追加しない。
- Gesture Layerを通常レイヤー一覧、Layersタブ、import/export、削除、並べ替えから隠す。
- Studioのbinding変更は既存Undo/RedoとグローバルSave/Discardに統合し、カード内保存ボタンを作らない。
- 旧FirmwareとRIP非対応は別々に判定し、Gesture Layerがなければ更新案内を表示する。
- すべてのproduction変更は対応テストのRED確認後に行う。
- ユーザーの既存変更 `.gitignore`、`.playwright-mcp/`、`work/` を変更・commitしない。
- GitHubへのpush、Issue、PR、コメントは行わない。

---

### Task 1: 予約Gesture LayerのStudio境界

**Files:**
- Modify: `src/keyboard/minimal-keys-layers.ts`
- Modify: `src/keyboard/minimal-keys-layers.test.ts`
- Modify: `src/keyboard/LayerPicker.tsx`
- Modify: `src/keyboard/LayerPicker.test.tsx`
- Modify: `src/behaviors/picker/LayersTab.tsx`
- Modify: `src/behaviors/picker/LayersTab.test.tsx`
- Modify: `src/keyboard/keymap-io.ts`
- Modify: `src/keyboard/keymap-io.test.ts`

**Interfaces:**
- Consumes: 既存固定layer index 4、7、8とkeymap import/export形式version 1。
- Produces: `GESTURE_LAYER_INDEX = 9`、`isInternalLayerIndex(index)`、`hasGestureLayer(layers)`、`getUserLayerCapacity(maxLayers)`。

- [ ] **Step 1: Gesture roleと内部layer保護の失敗テストを書く**

```ts
it("recognizes gesture layer 9 as an internal layer", () => {
  expect(getMinimalKeysLayerRole(9)).toBe("gesture");
  expect(isInternalLayerIndex(8)).toBe(true);
  expect(isInternalLayerIndex(9)).toBe(true);
  expect(canEditUserLayer(9)).toBe(false);
  expect(hasGestureLayer(Array.from({ length: 10 }))).toBe(true);
});
```

`LayerPicker.test.tsx`と`LayersTab.test.tsx`へ10 layer fixtureを追加し、`Gesture`が選択肢に出ないことをassertする。

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run:

```bash
npm test -- src/keyboard/minimal-keys-layers.test.ts src/keyboard/LayerPicker.test.tsx src/behaviors/picker/LayersTab.test.tsx
```

Expected: `GESTURE_LAYER_INDEX`または`isInternalLayerIndex`が未定義、もしくはGestureが表示されてFAIL。

- [ ] **Step 3: 内部layer判定を最小実装する**

```ts
export const PRECISION_LAYER_INDEX = 8;
export const GESTURE_LAYER_INDEX = 9;
export const MINIMAL_KEYS_LAYER_COUNT = GESTURE_LAYER_INDEX + 1;

export type MinimalKeysLayerRole = "autoMouse" | "scroll" | "precision" | "gesture";

export function isInternalLayerIndex(index: number): boolean {
  return index === PRECISION_LAYER_INDEX || index === GESTURE_LAYER_INDEX;
}

export function hasGestureLayer(layers: unknown[]): boolean {
  return layers.length > GESTURE_LAYER_INDEX;
}

export function getUserLayerCapacity(maxLayers: number): number {
  if (maxLayers > GESTURE_LAYER_INDEX) return maxLayers - 2;
  if (maxLayers > PRECISION_LAYER_INDEX) return maxLayers - 1;
  return maxLayers;
}
```

`LayerPicker`と`LayersTab`は`isPrecisionLayerIndex`の直接利用を`isInternalLayerIndex`へ置き換える。通常role badgeへGestureは追加しない。

- [ ] **Step 4: 内部layerをimport/exportから除外する失敗テストを書く**

```ts
it("omits precision and gesture layers from exported user data", () => {
  const result = serializeKeymap(keymapWithTenLayers, mockBehaviors, "1.0.0");
  expect(result.keymap.layers).toHaveLength(8);
  expect(result.keymap.layers.map((layer) => layer.name)).not.toContain("Gesture");
});

it("keeps two reserved layers out of ten-layer import capacity", () => {
  const result = deserializeKeymap(nineUserLayerPayload, mockBehaviors, 2, 10);
  expect(result).toEqual({ ok: false, error: { type: "layerCount", requested: 9, max: 8 } });
});
```

- [ ] **Step 5: import/exportテストのREDを確認する**

Run:

```bash
npm test -- src/keyboard/keymap-io.test.ts
```

Expected: exportがGestureを含む、またはimport上限が9になりFAIL。

- [ ] **Step 6: import/exportの内部layer除外を実装する**

```ts
layers: keymap.layers
  .filter((_layer, index) => !isInternalLayerIndex(index))
  .map((layer) => ({
    name: layer.name,
    bindings: layer.bindings.map((binding) => ({
      behaviorName: behaviorIdToName.get(binding.behaviorId) ?? `Unknown(${binding.behaviorId})`,
      param1: binding.param1,
      param2: binding.param2,
    })),
  }));

const maxUserLayers = getUserLayerCapacity(maxLayers);
```

- [ ] **Step 7: Task 1のテストをGREENにする**

Run:

```bash
npm test -- src/keyboard/minimal-keys-layers.test.ts src/keyboard/LayerPicker.test.tsx src/behaviors/picker/LayersTab.test.tsx src/keyboard/keymap-io.test.ts
```

Expected: 対象テストがすべてPASS、終了コード0。

- [ ] **Step 8: Studio境界をcommitする**

```bash
git add src/keyboard/minimal-keys-layers.ts src/keyboard/minimal-keys-layers.test.ts src/keyboard/LayerPicker.tsx src/keyboard/LayerPicker.test.tsx src/behaviors/picker/LayersTab.tsx src/behaviors/picker/LayersTab.test.tsx src/keyboard/keymap-io.ts src/keyboard/keymap-io.test.ts
git commit -m "feat: reserve gesture shortcut layer"
```

---

### Task 2: Gesture bindingモデルと既存keymap書込みへの接続

**Files:**
- Create: `src/trackball/gesture-bindings.ts`
- Create: `src/trackball/gesture-bindings.test.ts`
- Create: `src/trackball/useConnectedGestureKeymap.ts`
- Create: `src/trackball/useConnectedGestureKeymap.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.notification.test.ts`

**Interfaces:**
- Consumes: `GESTURE_LAYER_INDEX`、`ConnectionContext`、`LockStateContext`、`UndoRedoContext`、`call_rpc()`、`useBehaviorList()`、`KEYMAP_CHANGED_EVENT`。
- Produces: `GESTURE_DIRECTIONS`、`GestureDirection`、`getGestureBinding()`、`ConnectedGestureKeymap`、`useConnectedGestureKeymap()`。

- [ ] **Step 1: 方向とslot mappingの失敗テストを書く**

```ts
expect(GESTURE_DIRECTIONS.map(({ id, position }) => [id, position])).toEqual([
  ["up", 7],
  ["down", 31],
  ["left", 18],
  ["right", 20],
]);
expect(getGestureBinding(tenLayerKeymap, "left")).toEqual(
  tenLayerKeymap.layers[9].bindings[18],
);
expect(getGestureBinding(nineLayerKeymap, "up")).toBeNull();
```

- [ ] **Step 2: mappingテストのREDを確認する**

Run:

```bash
npm test -- src/trackball/gesture-bindings.test.ts
```

Expected: module未作成でFAIL。

- [ ] **Step 3: pure bindingモデルを実装する**

```ts
export const GESTURE_DIRECTIONS = [
  { id: "up", label: "上", arrow: "↑", position: 7 },
  { id: "down", label: "下", arrow: "↓", position: 31 },
  { id: "left", label: "左", arrow: "←", position: 18 },
  { id: "right", label: "右", arrow: "→", position: 20 },
] as const;

export type GestureDirection = (typeof GESTURE_DIRECTIONS)[number]["id"];

export function getGestureBinding(keymap: Keymap, direction: GestureDirection): BehaviorBinding | null {
  const slot = GESTURE_DIRECTIONS.find((candidate) => candidate.id === direction);
  return slot ? keymap.layers[GESTURE_LAYER_INDEX]?.bindings[slot.position] ?? null : null;
}
```

- [ ] **Step 4: 接続状態とUndo/Redo書込みの失敗テストを書く**

`useConnectedGestureKeymap.test.tsx`で接続、lock、RPC、UndoRedoをtest harnessから注入し、次を確認する。

```ts
expect(result.current.availability).toBe("available");
await act(() => result.current.updateBinding("up", nextBinding));
expect(callRpc).toHaveBeenCalledWith(expect.objectContaining({
  keymap: { setLayerBinding: {
    layerId: gestureLayer.id,
    keyPosition: 7,
    binding: nextBinding,
  } },
}));
expect(doIt).toHaveBeenCalledOnce();
```

別ケースでlayer数9は`firmware-update-required`、切断は`disconnected`、RPC失敗は`error`、undo callbackは元bindingを書き戻すことをassertする。

- [ ] **Step 5: hookテストのREDを確認する**

Run:

```bash
npm test -- src/trackball/useConnectedGestureKeymap.test.tsx
```

Expected: hook未作成でFAIL。

- [ ] **Step 6: 既存Undo/Redoへ統合するhookを実装する**

```ts
export interface ConnectedGestureKeymap {
  availability: "loading" | "available" | "disconnected" | "firmware-update-required" | "error";
  keymap: Keymap | null;
  behaviors: GetBehaviorDetailsResponse[];
  error: string | null;
  updateBinding(direction: GestureDirection, binding: BehaviorBinding): Promise<void>;
}
```

`updateBinding`はGesture Layerの永続`layer.id`と固定positionで`setLayerBinding`を呼ぶ。成功時だけ`publishKeymapChanged()`し、返したundo callbackは同じlayer ID・positionへ元bindingを書き戻して再度publishする。レスポンスが`SET_LAYER_BINDING_RESP_OK`以外ならローカル表示を更新せず`error`へする。

- [ ] **Step 7: Discard後の再読込通知テストを書く**

```ts
await discard();
expect(pub).toHaveBeenCalledWith(KEYMAP_CHANGED_EVENT, undefined);
```

- [ ] **Step 8: App discardから既存イベントを発行する**

`discardChanges`成功後、`reset()`と`setKeymapVersion()`に加えて`publishKeymapChanged()`を呼ぶ。Save処理は既存の`keymap_saved_success`を維持し、新しい保存処理を追加しない。

- [ ] **Step 9: Task 2をGREENにする**

Run:

```bash
npm test -- src/trackball/gesture-bindings.test.ts src/trackball/useConnectedGestureKeymap.test.tsx src/App.notification.test.ts
```

Expected: 対象テストがすべてPASS、終了コード0。

- [ ] **Step 10: keymap接続をcommitする**

```bash
git add src/trackball/gesture-bindings.ts src/trackball/gesture-bindings.test.ts src/trackball/useConnectedGestureKeymap.ts src/trackball/useConnectedGestureKeymap.test.tsx src/App.tsx src/App.notification.test.ts
git commit -m "feat: connect gesture bindings to keymap"
```

---

### Task 3: 4方向Gesture設定UI

**Files:**
- Create: `src/trackball/TrackballGestureSettings.tsx`
- Create: `src/trackball/TrackballGestureSettings.test.tsx`
- Modify: `src/trackball/TrackballSettings.tsx`
- Modify: `src/trackball/TrackballSettings.test.tsx`

**Interfaces:**
- Consumes: `useConnectedGestureKeymap()`、`BehaviorBindingPicker`、`formatBindingDetail()`、`getBehaviorDescription()`。
- Produces: `TrackballGestureSettings`カード。カード内に独立Save/Discardは持たない。

- [ ] **Step 1: 方向タイルと単一ピッカーの失敗テストを書く**

```tsx
render(<TrackballGestureSettings />);
expect(screen.getByRole("group", { name: "フリック方向" })).toBeVisible();
expect(screen.getByRole("button", { name: /上/ })).toHaveAttribute("aria-pressed", "true");
expect(screen.getByRole("button", { name: /左/ })).toHaveAttribute("aria-pressed", "false");
expect(screen.getAllByTestId("behavior-binding-picker")).toHaveLength(1);
```

方向buttonのclassへ`min-h-11`と`focus-visible:ring-2`が含まれ、割当名が`text-base-content/70`以上で表示されることもassertする。

- [ ] **Step 2: UIテストのREDを確認する**

Run:

```bash
npm test -- src/trackball/TrackballGestureSettings.test.tsx
```

Expected: component未作成でFAIL。

- [ ] **Step 3: 状態表示の失敗テストを書く**

```ts
expect(screen.getByText("キーボード共通")).toBeVisible();
expect(screen.getByText("ファームウェアの更新が必要です")).toBeVisible();
expect(screen.queryByText("ジェスチャー中")).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: /保存|適用/ })).not.toBeInTheDocument();
```

`disconnected`、`loading`、`firmware-update-required`、`error`、`available`をparameterized testで固定する。

- [ ] **Step 4: Gestureカードを最小実装する**

```tsx
const bindingLabel = (direction: GestureDirection): string => {
  const binding = getGestureBinding(keymap, direction);
  if (!binding) return "不明な操作";
  const behavior = behaviors.find((candidate) => candidate.id === binding.behaviorId);
  if (!behavior) return "不明な操作";
  if (behavior.displayName === "None") return "何もしない";
  const description = getBehaviorDescription(behavior.displayName);
  const detail = formatBindingDetail(behavior.displayName, binding, visibleLayers);
  return detail ? `${description.label}: ${detail}` : description.label;
};

<section aria-labelledby="trackball-gesture-title" className="space-y-4 rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
  <header>
    <h3 id="trackball-gesture-title" className="text-base font-bold">ジェスチャー</h3>
    <p className="text-sm text-base-content/70">I と O を同時押しするとジェスチャーモードが切り替わります。</p>
  </header>
  <div role="group" aria-label="フリック方向" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {GESTURE_DIRECTIONS.map((direction) => (
      <button
        key={direction.id}
        type="button"
        aria-pressed={selectedDirection === direction.id}
        onClick={() => setSelectedDirection(direction.id)}
        className="min-h-11 rounded-lg border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">{direction.arrow}</span>
        <span>{direction.label}</span>
        <span className="text-base-content/70">{bindingLabel(direction.id)}</span>
      </button>
    ))}
  </div>
  <p aria-live="polite" className="sr-only">{announcement}</p>
  {selectedBinding && <BehaviorBindingPicker binding={selectedBinding} behaviors={behaviors} layers={visibleLayers} onBindingChanged={handleBindingChanged} />}
</section>
```

各buttonは可視の矢印・方向名・現在割当、`aria-pressed`、`min-h-11`、`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`を持つ。選択中はチェックと`選択中`を表示する。未知behaviorは`不明な操作`、Noneは`何もしない`と表示する。

- [ ] **Step 5: TrackballSettingsへRIPと独立して配置する失敗テストを書く**

```ts
render(<TrackballSettings />);
expect(screen.getByTestId("precision-settings")).toBeVisible();
expect(screen.getByTestId("gesture-settings")).toBeVisible();
expect(screen.getByText("トラックボール設定は利用できません")).toBeVisible();
```

`useCustomSubsystem()`が`undefined`でもPrecisionとGestureの両方が表示されるfixtureを使う。

- [ ] **Step 6: TrackballSettingsへカードを組み込む**

RIPあり・なし両方のreturn pathで`TrackballPrecisionSettings`直後に`TrackballGestureSettings`を置く。RIP processorのloadingや`SubsystemUnavailable`をGesture可用性判定へ流用しない。

- [ ] **Step 7: Task 3をGREENにする**

Run:

```bash
npm test -- src/trackball/TrackballGestureSettings.test.tsx src/trackball/TrackballSettings.test.tsx
```

Expected: 対象テストがすべてPASS、終了コード0。

- [ ] **Step 8: Gesture UIをcommitする**

```bash
git add src/trackball/TrackballGestureSettings.tsx src/trackball/TrackballGestureSettings.test.tsx src/trackball/TrackballSettings.tsx src/trackball/TrackballSettings.test.tsx
git commit -m "feat: add trackball gesture shortcut editor"
```

---

### Task 4: Firmware gesture detectorと予約binding adapter

**Repository:** `/Users/iwanedaijun/repos/minimal-keys-release`

**Files:**
- Modify: `config/west.yml`
- Modify: `config/minimal-keys.keymap`
- Modify: `config/boards/shields/minimal-keys/minimal-keys_R.overlay`
- Modify: `config/boards/shields/minimal-keys/minimal-keys_R.conf`
- Modify: `zephyr/module.yml`
- Create: `CMakeLists.txt`
- Create: `dts/bindings/behaviors/minimal-keys,behavior-gesture-slot.yaml`
- Create: `src/behavior_gesture_slot.c`
- Create: `tests/test_gesture_config.py`
- Create: `docs/third-party-dependencies.md`

**Interfaces:**
- Consumes: `zmk-mouse-gesture` commit `62f3c9d8ca6763e160b73efc46108c61dd0243a0`、ZMK `zmk_keymap_layer_index_to_id()`、`zmk_keymap_get_layer_binding_at_idx()`、`zmk_behavior_invoke_binding()`。
- Produces: `&gesture_slot <position>`、Gesture Layer index 9、I+O combo、`&zip_mouse_gesture`の4方向pattern。

- [ ] **Step 1: Firmware用feature branchを作る**

`branch`スキルに従い、cleanな`codex/hold-tap-monitor-release`から`feat/trackball-shortcuts`を作り、ユーザーの原文を空commitへ記録する。pushはしない。

- [ ] **Step 2: 依存・layer・combo・processor結線の失敗テストを書く**

`tests/test_gesture_config.py`へ既存の`_node_body()`とmanifest parserを再利用して次をassertする。

```py
self.assertEqual(project_property(self.manifest, "zmk-mouse-gesture", "remote"), "kot149")
self.assertEqual(project_property(self.manifest, "zmk-mouse-gesture", "revision"), GESTURE_REVISION)
self.assertRegex(GESTURE_REVISION, r"^[0-9a-f]{40}$")
self.assertEqual(layer_names.index("gesture_layer"), 9)
self.assertEqual(gesture_bindings[7], "&kp LC(DOWN)")
self.assertEqual(gesture_bindings[18], "&kp LC(RIGHT)")
self.assertEqual(gesture_bindings[20], "&kp LC(LEFT)")
self.assertEqual(gesture_bindings[31], "&kp LC(UP)")
self.assertTrue(all(binding == "&none" for index, binding in enumerate(gesture_bindings) if index not in {7, 18, 20, 31}))
```

combo positions `<7 8>`、binding `&mouse_gesture_toggle`、上下左右patternのslot 7/31/18/20、`suppress-movement`、`enable-eager-mode`、`partial-gesture-timeout-ms = <400>`、normal/scroll両processor chainの先頭が`&zip_mouse_gesture`であることもassertする。

- [ ] **Step 3: Firmware構成テストを実行してREDを確認する**

Run:

```bash
/opt/homebrew/bin/python3 -m unittest tests/test_gesture_config.py -v
```

Expected: manifest project、Gesture Layer、combo、overlay設定がなくFAIL。

- [ ] **Step 4: 上流moduleを固定commitで追加し依存記録を書く**

`config/west.yml`へremoteとprojectを追加する。

```yaml
    - name: kot149
      url-base: https://github.com/kot149
    - name: zmk-mouse-gesture
      remote: kot149
      revision: 62f3c9d8ca6763e160b73efc46108c61dd0243a0
```

`docs/third-party-dependencies.md`へproject URL、固定SHA、MIT、利用範囲が方向認識のみであること、ローカル変更なしを記録する。

- [ ] **Step 5: adapter source契約の失敗テストを書く**

Python testで`behavior_gesture_slot.c`を読み、許可position `{7, 18, 20, 31}`、`zmk_keymap_layer_index_to_id(9)`相当、invalid ID拒否、NULL拒否、自己再帰拒否、press/release引数を`zmk_behavior_invoke_binding()`へ渡す構造をassertする。これはC runtime testの代替ではなく、実Firmware buildと実機受け入れを必須の補完とする。

- [ ] **Step 6: adapter testのREDを確認する**

Run:

```bash
/opt/homebrew/bin/python3 -m unittest tests/test_gesture_config.py -v
```

Expected: `src/behavior_gesture_slot.c`が存在せずFAIL。

- [ ] **Step 7: local Zephyr moduleと`gesture_slot`を実装する**

`zephyr/module.yml`:

```yaml
build:
  cmake: .
  settings:
    board_root: .
```

`CMakeLists.txt`:

```cmake
target_sources(app PRIVATE src/behavior_gesture_slot.c)
```

adapter本体の境界:

```c
#define GESTURE_LAYER_INDEX 9

static bool is_allowed_slot(uint32_t position) {
    return position == 7 || position == 18 || position == 20 || position == 31;
}

static int invoke_slot(struct zmk_behavior_binding *binding,
                       struct zmk_behavior_binding_event event, bool pressed) {
    if (!is_allowed_slot(binding->param1)) return -EINVAL;
    zmk_keymap_layer_id_t layer_id = zmk_keymap_layer_index_to_id(GESTURE_LAYER_INDEX);
    if (layer_id == ZMK_KEYMAP_LAYER_ID_INVAL) return -ENODEV;
    const struct zmk_behavior_binding *target =
        zmk_keymap_get_layer_binding_at_idx(layer_id, binding->param1);
    if (!target) return -ENOENT;
    if (strcmp(target->behavior_dev, binding->behavior_dev) == 0) return -ELOOP;
    event.layer = layer_id;
    event.position = binding->param1;
    return zmk_behavior_invoke_binding(target, event, pressed);
}
```

Devicetree behaviorはone parameterを受け、press/release callbackの双方から`invoke_slot()`を呼ぶ。

- [ ] **Step 8: Gesture LayerとI+O comboを追加する**

common keymapへ`gesture_slot` node、`CONFIG_ZMK_MOUSE_GESTURE`時だけ有効なI+O combo、43 bindingの`gesture_layer`を追加する。4方向以外は`&none`、初期値は`LC(DOWN)`、`LC(RIGHT)`、`LC(LEFT)`、`LC(UP)`とする。

- [ ] **Step 9: 右overlayへ方向認識を結線する**

```dts
#include <mouse-gesture.dtsi>
#include <dt-bindings/zmk/mouse-gesture.h>

&zip_mouse_gesture {
    stroke-size = <200>;
    idle-timeout-ms = <150>;
    partial-gesture-timeout-ms = <400>;
    gesture-cooldown-ms = <500>;
    enable-eager-mode;
    suppress-movement;

    up { pattern = <GESTURE_UP>; bindings = <&gesture_slot 7>; };
    down { pattern = <GESTURE_DOWN>; bindings = <&gesture_slot 31>; };
    left { pattern = <GESTURE_LEFT>; bindings = <&gesture_slot 18>; };
    right { pattern = <GESTURE_RIGHT>; bindings = <&gesture_slot 20>; };
};
```

通常chainを`<&zip_mouse_gesture &mouse_runtime_input_processor>`、Scroll overrideを`<&zip_mouse_gesture &zip_xy_to_scroll_mapper &scroll_runtime_input_processor>`にする。右confへ`CONFIG_ZMK_MOUSE_GESTURE=y`を追加する。

- [ ] **Step 10: Firmware構成テストをGREENにする**

Run:

```bash
/opt/homebrew/bin/python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Expected: gesture、precision、scrollを含む全PythonテストがPASS、終了コード0。

- [ ] **Step 11: Firmware変更をcommitする**

```bash
git add config/west.yml config/minimal-keys.keymap config/boards/shields/minimal-keys/minimal-keys_R.overlay config/boards/shields/minimal-keys/minimal-keys_R.conf zephyr/module.yml CMakeLists.txt dts/bindings/behaviors/minimal-keys,behavior-gesture-slot.yaml src/behavior_gesture_slot.c tests/test_gesture_config.py docs/third-party-dependencies.md
git commit -m "feat: add trackball gesture shortcuts"
```

---

### Task 5: 統合検証とレビュー

**Files:**
- Modify only if a failing test proves a defect in Task 1–4 files.
- Record evidence in the final report; do not create generated build artifacts in either repository.

**Interfaces:**
- Consumes: Studio feature branchとFirmware feature branchの全成果。
- Produces: 自動テスト、build、lint、runtime smoke、UIアクセシビリティ、Firmware build、実機境界の証拠。

- [ ] **Step 1: Studio全テストを実行する**

Run:

```bash
npm test
```

Expected: Vitestがテストを実際に検出し、全件PASS、終了コード0。

- [ ] **Step 2: Studio静的検証を実行する**

Run:

```bash
npm run build
npm run lint
git diff --check
```

Expected: 3コマンドとも終了コード0。

- [ ] **Step 3: Vite dev serverをsmoke testする**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Viteがlocal URLを表示し、HTTP GETが200を返す。確認後はプロセスを終了する。

- [ ] **Step 4: Tauri production buildを実行する**

Run:

```bash
npm run tauri build
```

Expected: Tauri app bundle buildが終了コード0。署名・notarization・配布は実行しない。

- [ ] **Step 5: UI実描画を確認する**

320px幅、800×600、200%ズームで、4方向タイル、選択中表示、単一ピッカー、スクロール到達性を確認する。Tab移動、フォーカスリング、方向buttonの読み上げ名、`aria-live`通知を確認する。VoiceOverを実行できない場合はDOM contractまでを検証済みとし、実読み上げを未検証にする。

- [ ] **Step 6: Firmware workspaceへfeature branchを反映してmoduleを更新する**

既存workspaceの`config` cloneをFirmware feature branchへ切り替え、`west update zmk-mouse-gesture`を実行する。既存workspaceにユーザー変更がある場合は上書きせず、新しい一時workspaceを作る。

- [ ] **Step 7: 左右Firmwareをbuildする**

Run:

```bash
west build -s zmk/app -d build/trackball-gesture-right -b seeeduino_xiao_ble -- -DSHIELD='minimal-keys_R rgbled_adapter raw_hid_adapter' -DSNIPPET=studio-rpc-usb-uart -DZMK_CONFIG="$PWD/config/config"
west build -s zmk/app -d build/trackball-gesture-left -b seeeduino_xiao_ble -- -DSHIELD='minimal-keys_L rgbled_adapter' -DZMK_CONFIG="$PWD/config/config"
```

Expected: 右・左とも終了コード0。右build logにmouse gestureとgesture slotが含まれ、左へトラックボールinput processorが入らない。

- [ ] **Step 8: reviewerで要件と実装を照合する**

コードレビューはCoverage / Evidence / Severity / Judgment / Unknowns形式で、仕様逸脱、保存二重化、内部layer露出、Firmware左右境界、外部依存ライセンス、テスト不足を確認する。High/Medium指摘は修正して該当テストをRED→GREENで再実行する。

- [ ] **Step 9: 実機受け入れ境界を記録する**

実機が利用可能ならI+O toggle、4方向各1回、cursor抑制、OFF復帰、保存後再起動、None、単独I/O、Scroll、Auto Mouse、Precision、USB/Bluetoothを確認する。利用できない場合はFirmwareを書き込んだ・動作したと報告せず、未検証項目を列挙する。

- [ ] **Step 10: 最終状態を照合する**

```bash
git status --short --branch
git log --oneline --decorate -6
git -C /Users/iwanedaijun/repos/minimal-keys-release status --short --branch
git -C /Users/iwanedaijun/repos/minimal-keys-release log --oneline --decorate -6
```

Expected: ユーザー既存変更だけが未commitで残り、タスク変更は各feature branchのcommitとして記録される。push、PR、mergeは行わない。

## Execution Choice

ユーザーは書面仕様を承認して実装続行を依頼済みで、プロジェクト規約は計画後の再承認を不要としている。したがって選択肢の再質問はせず、同一セッションで`superpowers:executing-plans`を使うInline ExecutionとしてTask 1から実行する。StudioとFirmwareの所有ファイルが分離できる段階では、プロジェクト規約に従い軽量実装担当を分け、共有仕様・最終統合・検証は主担当が保持する。
