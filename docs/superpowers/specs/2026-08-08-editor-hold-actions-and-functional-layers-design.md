# エディタの長押し動作と機能レイヤー 設計

**日付:** 2026-08-08

**状態:** ユーザー承認済み

**対象:** `minimal-keys-studio`。既存のFirmwareレイヤーID 4（Auto Mouse）、7（Scroll）、8（Precision）を利用し、RPC/protoとFirmwareの動作は変更しない。

## 目的

キーマップエディタで、短押しと長押しの2つの動作を持つキーを見分けられるようにする。同時に、Mod-TapとLayer-Tapで選べる短押しキーを実用上十分な一覧へ直し、MacとWindowsで同じ意味の表示名を使う。

Auto Mouse、Scroll、Precisionを固定用途の機能レイヤーとして一貫して扱い、Auto Mouseは通常レイヤーと同じように表示・編集できるようにする。ScrollとPrecisionは、選択したキーを押している間だけトラックボールの動作を切り替えられるようにする。

## 採用方針

用途別の共通タップキーカタログと、機能レイヤーの意味を示す固定IDを正本にする。

USB HIDの全項目を未整理のまま表示する案は、予約値や通常使わない項目が混ざり選びにくいため採用しない。現在の手書き一覧へ不足分だけ追加する案も、今後再び候補漏れとOS表記の不一致が起きるため採用しない。

## タップキーカタログ

### 収録範囲

Mod-TapとLayer-Tapは同じカタログを利用する。少なくとも次を含める。

- A〜Z、0〜9
- Space、Enter、Tab、Esc、Backspace、Delete、Insert
- 矢印、Home、End、Page Up、Page Down
- F1〜F24
- 一般的な記号とShift記号
- 左右のCtrl、Shift、Alt/Option、GUI/Cmd/Win
- Caps Lock、Print Screen、Scroll Lock、Pause、Menu/Application
- `ABC` と `あいう`

項目は意味ごとのグループで並べ、同一HID usageとmodifierの重複を作らない。タップ動作へ書き込む値は、現行と同じZMKのimplicit modifier形式を維持する。

### OS別の意味と表示

OSモードは既存の `OsModeContext` を正本とし、Mod-TapとLayer-Tapの候補表示へ渡す。

| 表示 | Mac | Windows |
| --- | --- | --- |
| `ABC` | LANG2（英数） | NonConvert / 無変換（IME OFF相当） |
| `あいう` | LANG1（かな） | Convert / 変換（IME ON相当） |
| GUI修飾 | Cmd / Option | Win / Alt |

画面上の主要な意味は両OSで `ABC`、`あいう` に統一する。詳細説明には実際に送信するOS固有キー名を併記し、同じ表示なのに異なるHID値を送ることをテストで固定する。

Windows側のIME結果はWindows日本語IMEのキー割当設定に従う。StudioはOSへ直接IME状態を命令せず、標準的な変換・無変換キーを送る。

## 長押しキーの表示

`Layer-Tap`、`LAYER_TAP_MKP`、`Mod-Tap`、`Hold-Tap` を、短押しと長押しで動作が変わるキーとして扱う。表示文字列ではなく、取得済みBehaviorの `displayName` から判定する。

エディタのキー表示へ次の状態を追加する。

- 通常時: オレンジ色の2px相当の枠
- ホバー時: オレンジ枠を維持したまま既存の浮き上がり表現
- 選択時: オレンジ枠を維持し、その外側へ既存の選択リングを表示
- 無効状態: オレンジ枠は残し、既存のopacityで無効を示す

色だけに依存しないよう、キーのアクセシブル説明へ「長押し動作あり」を追加する。リアルタイムモニターの押下中オレンジ表示とは別の機能であり、エディタでは「このキーは二役」という静的な意味を持つ。

## ScrollとPrecisionの割当

エディタに、用途が明確な2つの長押し動作を追加する。

- `押している間スクロール`: Scroll layer ID 7を長押し側へ設定
- `押している間精密モード`: Precision layer ID 8を長押し側へ設定

どちらも既存のLayer-Tap behaviorを使い、短押し側は共通タップキーカタログから選ぶ。これにより「短押しSpace、長押し中はスクロール」や「短押しEnter、長押し中は精密モード」を作れる。キーを離すと対象レイヤーが解除され、通常のポインター動作へ戻る。トグル動作は追加しない。

Precision layer自体は内部実装用なので、通常のレイヤー一覧には表示しない。専用アクション経由でID 8を設定する。既存の精密モード設定・CPI値・FirmwareのSNIPE動作を再利用し、別の速度管理を新設しない。

## Auto Mouseレイヤー

編集画面ではAuto Mouseを常時表示し、通常レイヤーと同じように選択・編集可能にする。モニター画面で非アクティブなAuto Mouseを省略する既存表示は維持する。

固定用途判定は配列indexではなく永続 `layer.id` を使う。

- Auto Mouse: ID 4
- Scroll: ID 7
- Precision: ID 8

この変更により、レイヤーを並べ替えても別レイヤーへAuto MouseやScrollのバッジが移らない。PrecisionはID 8を基準に非表示・import/export除外を維持する。

Firmwareには既にAuto Mouseのmovement activation、700ms timeout、Scroll layer、Precision layerがあるため、本変更では閾値・timeout・センサー処理を変更しない。

## データフロー

1. Studio RPCからkeymapとBehavior一覧を取得する。
2. `key-presentation` が各bindingのBehaviorから長押し動作の有無を判定し、`KeyPosition`へ渡す。
3. `PhysicalLayout` が状態を `Key`へ渡し、オレンジ枠とアクセシブル説明を描画する。
4. `TapKeySelect` はOSモードから共通カタログを生成し、選択結果をZMK binding値へ変換する。
5. Scroll/Precisionの専用アクションはLayer-Tapのparam1へ固定レイヤーID、param2へ選択した短押しキーを設定する。
6. Auto Mouse/Scroll/Precisionの表示役割は各layerの永続IDから解決する。

## エラー処理

- 必要なLayer-Tap behaviorがFirmwareから取得できない場合、Scroll/Precisionの専用アクションを無効化し理由を表示する。
- 必要な固定IDがkeymapに存在しない場合、その専用アクションを無効化し、存在しないレイヤーへbindingを書き込まない。
- 現在のbindingがカタログ外でも表示を消さず、「現在値」として保持する。別候補を選ぶまで勝手に置換しない。
- OSモード変更時は未適用の候補を新しいOSの意味へ黙って変換せず、選択を解除して再選択を求める。

## テスト

全変更をRED→GREENのTDDで行う。

- Mac/Windowsそれぞれで `ABC`、`あいう` が正しいHID値になること
- A〜Z、矢印、Home/End、F13〜F24、左右修飾キーなど代表的な候補が存在すること
- 同一HID usageとmodifierの候補が重複しないこと
- Mod-TapとLayer-Tapが同じOS別カタログを使うこと
- 長押しBehaviorだけがオレンジ枠と「長押し動作あり」の説明を持つこと
- 選択中の長押しキーでオレンジ枠と選択リングが共存すること
- Scroll専用アクションがID 7、Precision専用アクションがID 8のLayer-Tap bindingを生成すること
- 必要Behaviorまたは固定レイヤーがない場合に書込みを防ぐこと
- 編集画面ではAuto Mouse ID 4を常時選択でき、モニター側の省略表示は維持されること
- レイヤーを並べ替えてもID 4/7/8の役割表示が変わらないこと

検証ゲートは、関連テスト、全 `npm test`、`npm run build`、`npm run lint`、`npm run tauri build` とする。実機ではAuto Mouseの自動発火、Scroll長押し、Precision長押し、キー解放後の通常復帰を確認する。

## 非目標

- Auto Mouseの閾値やtimeout変更
- Scroll/Precisionのトグル動作
- 新しいRPC/protoまたはFirmware behaviorの追加
- Windows IME設定そのものの変更
- Consumer ControlやマウスボタンをMod-Tapの短押し側へ追加すること

## 完了条件

1. Mod-Tap/Layer-Tapで実用的な標準キーを選択できる。
2. Mac/Windowsの表示が同じ意味に揃い、`ABC`/`あいう`が各OSの正しいキーへ変換される。
3. 長押しで動作が変わるキーがエディタ上で常時オレンジ枠になる。
4. ScrollとPrecisionを押している間だけ有効にするキーをエディタから設定できる。
5. Auto Mouseが通常レイヤーとして表示・編集でき、移動後も固定IDに基づく役割が保たれる。
6. 自動テスト、ビルド、lint、Tauri buildが終了コード0で、実機動作を確認できる。
