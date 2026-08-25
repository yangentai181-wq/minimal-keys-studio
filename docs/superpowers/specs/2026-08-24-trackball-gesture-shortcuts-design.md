# トラックボール・ジェスチャーショートカット設計

**日付:** 2026-08-24

**状態:** ユーザー承認済み

**対象:** `minimal-keys-studio`、`minimal-keys-release`

## 目的

minimal-keysのトラックボールへ、Conductor Studioに近い4方向ジェスチャーショートカットを追加する。

- `I` と `O` の同時押しごとにジェスチャーモードをON/OFFする。
- モード中にトラックボールを上・下・左・右へ1回はじくと、方向ごとに設定したショートカットを1回実行する。
- 4方向の割当はStudioの既存ショートカット選択UIで編集する。
- 初版はキーボード共通設定とし、左右デバイス別の割当や起動キー変更は扱わない。

本機能は既存のキーマップ通信と保存処理を再利用し、専用RPCやprotoを追加しない。

## 既存資産の採否

### 採用

[`kot149/zmk-mouse-gesture`](https://github.com/kot149/zmk-mouse-gesture) をFirmwareのwest dependencyとしてコミット固定で採用する。MITライセンス、4方向ストローク、トグル起動、ジェスチャー中の通常移動抑制、タイムアウトを備え、今回の目的に最も近い。

上流モジュールは方向認識だけを担当する。Studioで編集可能なキーマップbindingを呼ぶための小さな `gesture_slot` adapterだけをFirmware設定側へ追加する。上流コードはコピーせず、ライセンス、固定コミット、適用範囲をFirmware側の依存記録へ残す。

### UIパターンだけ採用

[Conductor Studio](https://studio.plotoftheprototype.com/) の公開画面と公開フロントエンドbundleから、4方向タイルで対象を選び、選択中の1方向を編集する構成を参考にする。公開サイトからリンクされた実装リポジトリは取得・独立検証できなかったため、コードはコピーしない。

### 不採用

- `zettaface/zmk-input-processor-keybind`: ポインター移動を継続的なキー入力へ変換する用途が中心で、1フリックにつき1ショートカットという要件に合わない。
- 旧 `minimal-keys-config` の `TrackballShortcutEditor`: 画面概念は近いが、旧独自wireless protocol用で、対応Firmware実装と現在の保存経路がない。
- 専用Gesture RPC: 4つのbindingを既存キーマップで表現でき、通信仕様を増やす便益がない。

## 利用者体験

トラックボール設定画面の精密モード直後へ、既存カード様式の `ジェスチャー` カードを追加する。

```text
ジェスチャー                         [キーボード共通] [利用可能]
I と O を同時押しするとジェスチャーモードが切り替わります。
モード中にボールを上下左右へはじくと、設定した操作を実行します。

起動キー  [ I ] + [ O ]（固定）

方向を選ぶ
[ ↑ 上  App Exposé       ] [ ↓ 下  Mission Control  ]
[ ← 左  次のデスクトップ ] [ → 右  前のデスクトップ ]

選択中: 上フリック
[既存の BehaviorBindingPicker を1つ表示]
```

方向タイルは狭い画面では1列、`sm`以上では2列にする。各タイルには矢印、方向名、現在の割当名を表示する。選択中はTealの背景・枠に加えて、チェックまたは `選択中` の文字を表示し、色だけに依存しない。

方向ボタンは次を満たす。

- `role="group"` と `フリック方向` のラベルを持つ。
- 各ボタンに `aria-pressed` を設定する。
- 操作領域を44px以上にする。
- `focus-visible` のリングを表示する。
- 割当変更を `aria-live="polite"` で通知する。
- 矢印だけでなく `上`、`下`、`左`、`右` を常に表示する。

方向ごとにピッカーを4個並べない。選択中の方向に対する既存 `BehaviorBindingPicker` を1個だけ表示する。カード内に別の適用ボタンは設けず、キーマップ編集画面と同じグローバルSave/Discardへ統一する。

## 初期割当

macOSの標準的なMission Control操作に合わせて次を初期値とする。

| フリック | ZMK binding | 表示 |
|---|---|---|
| 上 | `&kp LC(DOWN)` | App Exposé |
| 左 | `&kp LC(RIGHT)` | 次のデスクトップ |
| 右 | `&kp LC(LEFT)` | 前のデスクトップ |
| 下 | `&kp LC(UP)` | Mission Control |

Studioで `何もしない` を選んだ方向は `&none` として保存し、その方向では入力を生成しない。隠しレイヤーの透明bindingへフォールバックして通常キーを誤発火させてはならない。

## Firmware設計

### モジュール統合

`minimal-keys-release` のwest manifestへ `zmk-mouse-gesture` を固定コミットで追加する。追従先ブランチだけを指定せず、検証済みcommit SHAを正本にする。

右側central Firmwareだけがトラックボール入力とジェスチャー認識を持つ。左側Firmwareへ不要なセンサー処理を追加しない。既存のPMW3610、runtime input processor、Scroll Layer、Auto Mouse、Precision処理の順序と通常動作を維持する。

ジェスチャーモード中は通常のポインター移動を抑制する。モード外では従来どおりポインター、スクロール、Auto Mouse、Precision処理を行う。部分入力は上流モジュールのタイムアウトで破棄し、古いストロークが次回ジェスチャーへ残らない設定にする。

### 起動コンボ

既存の物理位置に合わせ、`I` のposition 7と `O` のposition 8をZMK comboへ登録する。コンボは `&mouse_gesture_toggle` を呼び、同時押しごとにモードをON/OFFする。コンボ成立時は通常の `I` と `O` を送信しない。単独入力は従来のbindingを維持する。

### 予約Gesture Layer

既存の0〜8に続くlayer index 9を、キーボード共通の予約 `Gesture` layerとする。Studioの通常レイヤー一覧、レイヤー動作ピッカー、キーマップimport/exportから隠し、削除・並べ替え・通常編集の対象にしない。

方向はConductorの物理配置パターンに合わせ、次のpositionへ保存する。

| 方向 | 物理キー | position |
|---|---|---:|
| 上 | I | 7 |
| 左 | J | 18 |
| 右 | L | 20 |
| 下 | , | 31 |

4枠以外を含むGesture Layerの未使用bindingは `&none` にする。

### `gesture_slot` adapter

上流モジュールの4方向bindingを、次の固定パラメーターへ接続する。

- 上: `&gesture_slot 7`
- 左: `&gesture_slot 18`
- 右: `&gesture_slot 20`
- 下: `&gesture_slot 31`

adapterは `zmk_keymap_layer_index_to_id(9)` で予約indexを永続layer IDへ変換し、そのIDとpositionを `zmk_keymap_get_layer_binding_at_idx()` へ渡す。取得したbindingだけをpress/releaseし、透明bindingの通常レイヤー探索は行わない。positionが4つの許可値以外、layer ID変換またはbinding取得に失敗した場合は何も実行せずエラーを記録する。

adapterの公開責務は `予約レイヤーの指定positionに保存された1 bindingを1回実行する` だけとし、方向判定、永続化、Studio通信を持たせない。

## Studio設計

### レイヤーメタデータ

既存のAuto Mouse、Scroll、Precisionと同じレイヤーメタデータに `gesture` roleと固定index 9を追加する。Gesture Layerは内部レイヤーとして以下から除外する。

- 通常の `LayerPicker`
- `BehaviorBindingPicker` のLayersタブ
- キーマップexport
- importによる上書き
- レイヤー削除・並べ替え対象

旧Firmwareはlayer index 9を持たない。Studioはキーマップにindex 9と必要なpositionが存在することを能力判定に使い、専用RPCの有無では判定しない。

### ジェスチャー設定状態

`TrackballGestureSettings` は既存keymap stateから4方向のbindingを読み、選択中方向だけをローカルUI stateとして持つ。割当変更は既存のkeymap draftへ書き、既存dirty stateへ登録し、キーマップ変更イベントを発行する。

Save成功でFirmwareへ永続化され、Discardで接続時または直前保存済みbindingへ戻る。ジェスチャーカード内に独立したconfirmed stateや保存処理を作らない。

### 状態表示

状態語を次の目的に限定する。

- スコープ: `キーボード共通`
- 能力状態: `利用可能`、`読み込み中`、`ファームウェア更新が必要`
- 保存状態: `未保存の変更があります`

Studioはキーボード上で現在ジェスチャーモードがONかOFFかを取得しないため、`ジェスチャー中`、`作動中`、`有効` などのライブ状態に見える表示を行わない。

Gesture Layerがない旧Firmwareではカードを隠さず、説明と `ファームウェア更新が必要` を表示して編集UIを無効化する。他のトラックボール設定は引き続き利用できる。RIP subsystemの可否をGesture Layerの可否と同一視しない。

## データフロー

1. Studioが既存のkeymap RPCで全レイヤーを読む。
2. layer index 9の存在と必要positionを確認する。
3. 4方向のbindingを方向タイルへ表示する。
4. 利用者が方向を選び、既存ピッカーでbindingを変更する。
5. 変更を既存keymap draftとdirty stateへ登録する。
6. グローバルSaveが既存keymap RPCで変更をFirmwareへ書く。
7. 既存の保存確認処理が成功した時だけdirty stateを解消する。
8. キーボード上でジェスチャーが成立すると、方向認識モジュールが `gesture_slot` を呼び、保存済みbindingを実行する。

新しい通信message、ブラウザー永続化、デバイス別設定ストアは追加しない。

## エラー処理

- Gesture Layerがなければ編集せず、Firmware更新案内を表示する。
- layerはあるが必要positionが不足する場合も非対応として扱い、配列外へ書かない。
- 読めないbindingは `不明な操作` と表示し、勝手に初期値へ上書きしない。
- 保存失敗時は既存keymap Save/Discardのエラー処理へ従い、成功表示にしない。
- 方向選択中に切断しても、ブラウザー値を端末の確定値として表示しない。
- Firmware adapterが不正positionを受けてもbindingを実行しない。
- 部分ジェスチャーやタイムアウトはショートカットを実行せず破棄する。

## テスト戦略

すべての変更をRED→GREEN→REFACTORのTDDで行う。設定ファイルだけの変更は、対応するbuildまたは構成検証を先に失敗させてから追加する。

### Studio自動テスト

- Gesture Layer index 9が内部roleとして判定される。
- Gesture Layerが通常レイヤー一覧、Layersタブ、import/exportから除外される。
- 上・左・右・下がposition 7、18、20、31へ正しく対応する。
- 4方向の現在bindingを表示し、選択した1方向だけを編集する。
- 方向ボタンが `aria-pressed`、可視方向名、focus ring、44px以上の領域を持つ。
- binding変更が既存dirty stateとSave/Discardへ統合される。
- `&none` が何もしない割当として保持される。
- layer index 9がない旧Firmwareでは更新案内を表示し、他設定を隠さない。
- RIP subsystemがなくてもGesture Layerがあればカードを利用できる。

### Firmware自動検証

- `gesture_slot` が許可positionのbindingをpress/releaseする。
- 不正position、layerなし、binding取得失敗では何も実行しない。
- I+O comboがtoggle behaviorへ解決され、単独I/Oのbindingを変えない。
- 4方向patternが正しいslot positionへ解決される。
- Gesture Layerの4方向以外が `&none` である。
- 右Firmware buildが終了コード0になり、左Firmwareも回帰なくbuildできる。

上流モジュール自身の方向認識テストは再実装しない。固定した上流commitのテスト・変更履歴を確認し、minimal-keys側では結線とadapter境界を検証する。

### Studio検証

- `npm test`
- `npm run build`
- `npm run lint`
- `npm run dev` の起動確認
- `npm run tauri build`
- 320px幅、800×600、200%ズームでカードとピッカーの到達性を確認
- キーボード操作とVoiceOverの読み上げ順を確認

### 実機受け入れ

- I+O同時押しでジェスチャーモードがONになり、もう一度でOFFになる。
- モード中の上下左右フリックが各1回だけ初期ショートカットを実行する。
- モード中は通常カーソルが動かず、OFF後は通常移動へ戻る。
- Studioで4方向を変更・保存し、再接続・再起動後も保持される。
- `何もしない` の方向は入力を生成しない。
- 単独のIとO、Scroll、Auto Mouse、Precisionが回帰しない。
- 左右分割接続、USB、Bluetoothの既存入力が回帰しない。

実機が利用できない場合は、自動テストとbuildを完了しても実機受け入れを未検証として明記する。

## 対象外

- デバイス別のジェスチャー割当
- I+O以外の起動キー編集
- 斜め方向、複数ストローク、ジェスチャー感度のStudio編集
- ライブON/OFF状態のStudio表示
- Gesture Layerの通常レイヤー編集
- Conductor Studioコードのコピー
- トラックボール設定画面全体の再設計
- 新しいRPC、proto、ブラウザー永続化

## 完了条件

1. I+Oでジェスチャーモードを安全にON/OFFできる。
2. 上下左右フリックがGesture Layerの4 bindingを1回ずつ実行する。
3. Studioで4方向を既存ピッカーから変更し、既存Save/Discardで永続化できる。
4. Gesture Layerは通常編集・import/exportから隠れ、旧Firmwareは安全に案内される。
5. Studio自動テスト、build、lint、dev smoke、Tauri buildと左右Firmware buildの終了コードが0になる。
6. 実機検証の実施結果または未検証範囲が明確に記録される。
