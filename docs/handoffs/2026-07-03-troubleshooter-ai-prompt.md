# トラブルシューターAI依頼プロンプト

あなたは接続トラブルの切り分けに強いトラブルシューターAIです。

以下の引き継ぎ資料をまず全文読んでください。

`/Users/iwanedaijun/repos/minimal-keys-studio/docs/handoffs/2026-07-03-minimal-keys-studio-connection-troubleshooting.md`

もしあなたの実行環境からこのファイルを読めない場合は、ユーザーに資料本文を貼ってもらってから進めてください。

## 目的

minimal-keys Studio の接続不良について、アプリ・Chrome/Web Serial・macOS・BLE・ファームウェアのどこが原因かを証拠ベースで切り分け、次に取るべき最短手順を確定してください。

特に確認したいことは以下です。

1. USB CDC ACM ポートは開けるのに ZMK Studio RPC `core.getDeviceInfo` が返らない原因
2. BLE Studio 経路が実機で通るか
3. USB Studio RPC を使うにはファームウェア側で何を確認・焼き直しすべきか
4. iPad向けリアルタイムモニター用途は Studio RPC ではなく Raw HID 経路を採用すべきか

## 作業場所

メインリポジトリ:

`/Users/iwanedaijun/repos/minimal-keys-studio`

関連ファームウェアリポジトリ:

`/Users/iwanedaijun/repos/minimal-keys-release`

Raw HID 参考実装:

`/Users/iwanedaijun/repos/zmk-web-configurator/lib/use-webhid.ts`

## 重要な制約

- 既存の未コミット差分を勝手に revert しないでください。
- UI/PWA/モニター系の変更が同じブランチに混ざっています。接続調査に不要でも消さないでください。
- 推測で修正を重ねず、各層ごとに証拠を取ってから判断してください。
- USBで詰まった場合でも、必ず BLE と Raw HID の可能性を並行して見てください。
- 変更を入れる場合は、該当するテスト・lint・build を実行して結果を報告してください。

## まずやること

1. 引き継ぎ資料を全文読む。
2. `git status --short --branch` で作業状態を確認する。
3. USBデバイスが見えているか確認する。
   - `ls -l /dev/cu.* /dev/tty.*`
   - `ioreg -p IOUSB -l -w 0 | rg -C 8 'minimal-keys|minimal_keys|ZMK Project'`
4. USBポートが他プロセスに掴まれていないか確認する。
   - 例: `lsof /dev/cu.usbmodem* /dev/tty.usbmodem*`
5. BLE状態を確認する。
   - `blueutil --paired --format json | jq '.[] | select((.name // "") | test("minimal|keys"; "i"))'`
   - `system_profiler SPBluetoothDataType | rg -i -C 8 'minimal-keys'`
6. Webアプリで `BLEで接続` を試した時の挙動とログを確認する。
7. ファームウェア側で `studio-rpc-usb-uart` が実際に有効なUF2を右側 central に焼けているか、build設定と実機状態を突き合わせる。

## 現時点の最有力仮説

USB CDC ACM は存在するが、そのポートに ZMK Studio RPC が流れていない、または現在実機に入っている右側ファームが USB Studio RPC に応答していません。

一方で、ファームウェア設定には `CONFIG_ZMK_STUDIO_TRANSPORT_BLE=y` があり、macOS 上でも `minimal-keys` は BLE ペアリング済みとして見えています。したがって、編集経路としては BLE が本命です。

また、実機には Raw HID らしき vendor HID interface (`usagePage 0xff60`, `usage 0x61`) が見えており、リアルタイムモニター用途は Raw HID の方が適している可能性があります。

## 成果物

最後に以下を短くまとめてください。

- 根本原因または最有力原因
- USBで今起きていること
- BLEで通る/通らないの確認結果
- USB Studio RPC を使うために必要なファームウェア側アクション
- Raw HID をモニター機能に使うべきかの判断
- 変更したファイルがある場合はファイル一覧
- 実行した検証コマンドと結果

## 注意

「ケーブルを抜き差ししてください」で終わらせないでください。
この問題はすでに、Web Serial の `port.open()` 成功後に `core.getDeviceInfo` がタイムアウトするところまで切り分け済みです。
