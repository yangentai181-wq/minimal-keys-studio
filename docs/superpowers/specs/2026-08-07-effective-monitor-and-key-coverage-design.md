# 実効キーモニターと標準キー補完 設計

## 目的

リアルタイムモニターには設定上の \`Transparent\` ではなく、その瞬間に実際に発火するキーまたは動作を表示する。同時に、現行キーマップを一般的なキーボードと照合し、日常利用で重要なのに入力経路がないキーを、既存操作を壊さず補う。

編集画面は設定そのものを扱うため「透過」を残す。リアルタイム画面だけが実効結果を表示する。

## 実効キー解決

- Studio RPCで取得した編集済み \`Keymap\` とbehavior一覧を正本にする。
- Raw HIDの \`activeLayerMask\` は配列indexではなく永続 \`layer.id\` のビットとして扱う。
- \`keymap.layers\` を優先度の高い順に走査し、有効なlayerだけを候補にする。
- \`Transparent\` だけは次の有効な下位layerへ進む。
- \`None\` は「無効」、\`To Layer 0\` は「通常へ戻る」としてそこで停止する。
- 解決不能なbehaviorは「不明」とし、出荷時QWERTYを現在値として偽装しない。
- 結果には表示名に加え、解決元layer ID/indexと透過継承の有無を保持する。
- 編集中のキーマップを共有contextへ公開し、モニター側でRPCを重複取得しない。
- Studio RPCを使えないモニター単体画面は固定表を使うが、「出荷時設定の目安」と明示する。
- 43キー分の解決は \`keymap\`、behavior、layer maskが変化した時だけ再計算し、pointer frameでは再計算しない。

## 表示上の矛盾修正

- L8を「精密モード」として扱い、L8自身は全透過なので下位の実効キーを表示する。
- L4 Auto Mouseの \`&to 0\` を \`L0\` ではなく「通常へ戻る」と表示する。
- L1はテンキーHIDではなく主数字キー \`N0..N9\` を使っているため、layer名を「数字」に直す。
- 最新キーは押下中集合の最大値やSet順ではなく、monitor storeが保持する最後のキーイベントを両画面で共有する。
- pointer sampleは無期限に現在動作として見せず、「直近の移動」と表示し、一定時間後は「停止中」に戻す。
- layer behaviorのparam1も配列indexではなくlayer IDとして名前解決し、layer並べ替え後の誤表示を防ぐ。

## 標準キー監査

既に入力できるものは重複させない。A-Z、通常数字0-9、Backspace、Tab、Space、Enter、Esc、左右移動、Home/End/Page、F1-F12、基本記号、macOS修飾、メディア操作は既存経路を維持する。

日常利用の不足として次を追加する。

| Layer / position | 割当 | 理由 |
| --- | --- | --- |
| L2 / 21（Backspace位置） | \`&kp DELETE\` | ナビlayer＋Backspaceで前方削除 |
| L2 / 10（A位置） | \`&kp INSERT\` | ナビゲーション群へ集約 |
| L3 / 28, 29（N, M位置） | \`&kp LBKT\`, \`&kp RBKT\` | 未修飾の \`[\` \`]\` が欠落。現状のカンマ・ピリオド重複を置換 |
| L5 / 22（Shift位置） | \`&kp CAPSLOCK\` | 機能layerへ低頻度ロックキーを配置 |
| L5 / 4, 5 | \`&kp LG(LS(N3))\`, \`&kp LG(LS(N4))\` | macOSの全画面・選択範囲スクリーンショット |
| L5 / 6, 7 | \`&kp C_BRI_DN\`, \`&kp C_BRI_UP\` | macOSで使用頻度の高い輝度操作 |
| L5 / 8, 9 | \`&kp C_VOL_DN\`, \`&kp C_VOL_UP\` | エンコーダ以外にも確実な音量操作を用意 |

PrintScreen、Scroll Lock、Pause、Menu/Application、F13-F24、右側のCtrl/Alt/GUI、実テンキーHID一式は、43キーの常設枠を消費する価値が低いため既定配列へは追加しない。必要時には既存Studio pickerから個別設定できる。

## データ境界

- Studio: 実効解決、共有context、表示、layer ID対応、latest event、固定表の注記を担当する。
- Firmware config: 既定キーマップの不足キー追加とコメントを担当する。
- RPC/protoは変更しない。
- 接続直後のlayer snapshot送信は別module変更を伴うため、本変更ではStudio側の最新受信値を正しく扱うところまでとし、初回snapshotプロトコルの新設は行わない。

## テスト

- 多段Transparent、L8＋L3、None停止、To Layer停止、並べ替え済みlayer ID、編集直後の反映、不明behaviorを純関数テストする。
- 最新キーの押下・解放・同時押しとpointer停止表示をstore/componentテストする。
- 接続中表示に \`Trans\` が残らず、モニター単体には出荷時注記が出ることを画面テストする。
- Firmware configは43 binding数、追加position、L1が主数字HIDであること、L8全透過を自動検査する。
- Studioのtest/build/lint、Tauri build、firmware buildを終了コード0まで確認する。

