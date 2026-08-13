# v0.6.0 トラックボール・長押し設定の選択移植 設計

**日付:** 2026-08-10

**状態:** ユーザー承認済み

**対象:** `minimal-keys-studio`、`zmk-module-runtime-input-processor`、`pmw3610-driver-minimal`、minimal-keys Firmware設定

## 目的

[公開版 minimal-keys Studio v0.6.0](https://github.com/hyhy-masa/minimal-keys-studio/releases/tag/v0.6.0) のうち、現在のアプリへ有用な次の3機能だけを取り込む。

- スクロールになるレイヤーの任意設定
- Auto Mouseの有効化、対象レイヤー、復帰時間の設定
- 長押し設定の名称・説明・対象キー表示の改善

現在の画面構成とデザインを維持し、v0.6.0のUI全体や無関係な修正は移植しない。

## 既存設計との関係

本設計は `2026-08-08-editor-hold-actions-and-functional-layers-design.md` のうち、Scrollを固定レイヤーID 7として表示する部分と、Auto Mouseのtimeout変更を非目標とした部分を更新する。

- Scrollの初期値は現在のレイヤー7を維持できるが、ユーザーが別の既存レイヤーまたは「なし」へ変更できる。
- Auto Mouseの初期対象は現在のレイヤー4を維持できるが、ユーザーが別の既存レイヤーへ変更できる。
- Precisionの固定ID 8と、キー割当画面にある「押している間スクロール」「押している間精密モード」はそのまま維持する。

## UI設計

### スクロールレイヤー

現在のトラックボール設定画面へ `スクロールするレイヤー` を追加する。選択肢は次の単一選択とする。

- `なし`
- キーマップから取得した既存レイヤー名

複数レイヤーを同時指定するUIは設けない。`なし` は値0であり、「全レイヤー」ではなく「どのレイヤーでもスクロールしない」を意味する。

Firmwareから複数ビットの旧設定を受け取った場合は、勝手に1つへ丸めない。「複数レイヤーが設定されています。次に選んだ1つへ置き換わります」と表示する。

### Auto Mouse

現在の静的な `Auto Mouse Layer / Timeout` 表示を、次の編集可能な設定へ置き換える。

- `ボールを動かしたらAuto Mouseを有効にする` トグル
- `Auto Mouseレイヤー` 単一選択
- `ボール停止後に戻るまで` 100〜5000ms、50ms刻み

Firmwareに既に存在する起動待ち時間は画面へ出さず、現在値を変更しない。詳細設定を増やすより、日常的に調整する3項目へ絞る。

### 長押し設定

RPCから返る内部名をそのまま見せず、既知の名前を日本語へ変換する。未知の名前は消さず、読める形へ整形したフォールバック名を表示する。

各設定には、現在のキーマップを走査して次を表示する。

- この設定を使っているキー数
- レイヤー名とキー名または物理位置
- 0件の場合は通常一覧から隠し、`未使用の設定を表示` を開いた時だけ表示

時間項目は現在の10ms刻みを維持する。1ms単位入力は追加しない。表示名と説明は次の初心者向け表現を正本とする。

- `長押し判定までの時間`: 押してから長押しになるまで
- `連打を単押しにする時間`: 素早く連打した時に単押しとして扱う範囲
- `直前の入力を待つ時間`: 前のキー操作直後の誤長押しを防ぐ時間
- `判定方法`: 他のキーを押した時に単押し／長押しをどう決めるか

## データ境界

### Scroll

`cormoran_rip` protocolへ、公開版と同じ互換フィールドを追加する。

- `InputProcessorInfo.scroll_layers = 18`
- `SetScrollLayersRequest`（Request oneof field 20）
- `SetScrollLayersResponse`（Response oneof field 21）

Firmwareの値はレイヤーindexのビットマスクである。Studioは画面で選んだlayerを現在の配列から探し、`1 << layer.index` へ変換する。Auto Mouseの対象値とは意味が違うため、共通の数値型だけで扱わず、変換関数とテストを分ける。

PMW3610 driverはruntimeのscroll layer maskを保持・取得・永続化し、RIPの専用handlerだけがそのAPIを呼ぶ。RIPの `active_layers` は入力プロセッサ全体の有効範囲なので、Scroll設定には再利用しない。

レイヤーの削除・並べ替えは、index保存設定のID移行が終わるまで引き続き無効とする。

### Auto Mouse

既存の次のRIPフィールドとsetterを再利用し、新しいRPCは追加しない。

- `temp_layer_enabled`
- `temp_layer_layer`
- `temp_layer_deactivation_delay_ms`

Auto Mouseの対象は `zmk_keymap_layer_activate()` に渡すlayer IDである。Studioは選択したlayerの永続 `layer.id` を送る。Scrollのindex変換と混同しない。

### 長押し

長押しRPC/protoは変更しない。内部名からBehaviorへの既知マッピング、キーマップ内の利用箇所、UIコピーはStudio側で解決する。マッピングできない項目も編集不能にはせず、対象キー不明として表示できる。

## 状態と保存

1. 接続時にkeymap、Behavior一覧、RIP processor情報、長押し設定を取得する。
2. 取得値をconfirmed state、画面操作をdraft stateとして分離する。
3. `適用` は差分がある項目だけを送る。
4. 各書込みは応答に加えてnotificationまたは再読込で確認する。
5. 全項目が確認できた時だけdraftをconfirmedへ昇格する。
6. 途中で失敗した場合はFirmwareを再読込し、確定済みの値と未保存の入力を区別して表示する。

旧Firmwareが `SetScrollLayers` を解釈できない場合、現在値へ戻し「スクロールレイヤーの変更にはFirmware更新が必要です」と表示する。他のトラックボール設定は利用可能なままにする。

## エラー処理

- 選択layerが保存直前に消えていた場合は送信せず、一覧を再読込する。
- Scrollでindexが31を超えるlayerは32bit maskへ表現できないため選択不可にする。
- Auto Mouseの対象IDがFirmwareのlayer範囲外なら保存しない。
- timeout、空応答、明示的errorは成功扱いにしない。
- 通知待ち中に切断した場合はdraftを保持し、再接続後の確定値との差を再表示する。
- reset後は静的な表示値を当てず、必ずFirmwareを再読込する。

## テスト

すべてのコード変更をRED→GREENのTDDで行う。

### Studio

- `scroll_layers` field 18のdecodeとSetScrollLayers field 20のbyte列
- `なし = 0`、選択layerのindex bit、layer IDとindexが異なるケース
- 複数bitの旧値を勝手に単一選択へ変換しないこと
- Auto Mouseはlayer IDを送り、Scrollはindexを送ること
- Auto Mouseのenabled、target、deactivation delayの差分保存と再読込
- 起動待ち時間をUI操作で変更しないこと
- 日本語名、対象キー数、未使用項目の初期非表示、未知名フォールバック
- 10ms刻みを維持し、対象キー外の設定を変更しないこと
- 旧Firmware、timeout、途中失敗時のrollback／draft保持

### Firmware

- runtime scroll maskのget/set、0、単一bit、永続化、再起動復元
- RIP handlerの成功、対象deviceなし、PMW3610なし、不正layer
- Auto Mouseの有効化、対象layer ID、停止後の解除、永続化
- ScrollとAuto Mouseを同時利用しても、回転・軸反転・速度処理が無効にならないこと
- 右Firmware buildと、左Firmwareに不要なsubsystemが入らないこと

### 実機

- `なし` ではどのlayerでも通常ポインターになる。
- 選んだ1layerだけがスクロールになり、別layerでは通常ポインターになる。
- ボール移動で指定したAuto Mouse layerが有効になり、設定時間後に戻る。
- Auto Mouse無効時はボール移動でlayerが変わらない。
- 長押しの変更が実際に表示された対象キーへだけ反映される。
- 再起動、USB再接続、アプリ再起動後も設定が残る。

## 非目標

- v0.6.0のUI全体、テーマ、画面構成の移植
- Scrollの複数選択
- Auto Mouseの起動待ち時間を公開すること
- 長押しの1ms単位入力
- Precision layerやCPI設定の再設計
- layer index保存設定全体のID移行と、レイヤー並べ替えの再有効化

## 完了条件

1. 既存UI内でScrollを「なし」または任意の1layerへ設定できる。
2. Auto Mouseの有効状態、対象layer、復帰時間を設定できる。
3. 長押し設定が日本語で理解でき、影響するキーを確認できる。
4. StudioとFirmwareのprotocol、永続化、旧版エラーが安全に扱われる。
5. 自動テスト、Studio build/lint/Tauri build、左右Firmware buildが終了コード0になる。
6. 実機でScroll、Auto Mouse、長押し、再起動後の保持を確認できる。
