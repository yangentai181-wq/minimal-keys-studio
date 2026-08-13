# Opus 5 外部 UI/UX 監査

- 実施日: 2026-08-05
- 対象: `minimal-keys-studio` / `codex/trackball-precision-settings` / `6307852`
- 実行モデル: `claude-opus-5`（Claude Codeの実行結果 `modelUsage` で確認）
- 方法: 読み取り専用のソースコード・テスト監査。アプリ実行・実機接続は未実施。
- 判定: **条件付き不合格**。内部設計は堅いが、非技術者向けUIとして重大な誤表示・接続導線・表示領域の問題が残る。

## エグゼクティブサマリー

Opus 5は、プロトコル・状態機械・テストを平均以上と評価した。一方で「内部の正しい状態を、利用者へ正しく見せる最後の一段」が未完成と判定した。

件数は Critical 4件、High 9件、Medium 14件、Low 8件。

## Critical

1. **Tauriデスクトップ版に主導線の「右手USB接続」が存在しない**
   - 根拠: `src/App.tsx:458`, `src/ConnectModal.tsx:430-449`, `src/connection/rawHid.ts:44-50`
   - 影響: デスクトップ版では右手USBの推奨ボタンとリアルタイム監視に到達できず、未接続カードだけが残る。

2. **読み込み中・切断中を「ファームウェアの更新が必要」と誤表示する**
   - 根拠: `src/trackball/TrackballPrecisionSettings.tsx:14-24`, `src/trackball/TrackballPrecisionContext.tsx:55,104-110`
   - 影響: 正常な読み込み待ちや一時的切断で、利用者を不要なファーム更新へ誘導する。

3. **既定の800×600ウィンドウでは編集領域が潰れ、スクロールでも逃げられない**
   - 根拠: `src-tauri/tauri.conf.json:69-77`, `src/App.tsx:507-572`, `src/StudioConnectionOverview.tsx:132-192`
   - 影響: 接続概要だけで高さを使い切り、肝心の設定画面が見えない可能性が高い。

4. **失敗時メッセージ22箇所が英語のまま**
   - 根拠: `src/keyboard/Keyboard.tsx:339,363`, `src/trackball/TrackballSettings.tsx:62,163,193` ほか
   - 影響: 最も説明が必要な失敗時だけ、非技術者が理解できない。

## High

1. revision更新時に未保存の精密モード編集が無言で破棄される可能性がある（`src/trackball/precision-state.ts:52-61`）。
2. 精密モード読み込み失敗が無限ローディングになり、再試行ボタンがない（`src/trackball/TrackballPrecisionContext.tsx:126-130`, `TrackballPrecisionSettings.tsx:39-41`）。
3. 切断時に最後の確定値が消え、ファーム更新要求へ化ける（`src/trackball/precision-state.ts:112-115`）。
4. CPIと倍率という異なる「速さ」が同一画面に並び、「保存」と「適用」も混在する（`src/trackball/TrackballSettings.tsx:223,262-283,396-410`）。
5. 左手の無線接続状態が概要に無く、Bluetooth画面でも自動更新されない（`src/bluetooth/BleManagement.tsx:26-63,272-301`）。
6. 精密モード中のレイヤー名が生の `L8` になる（`src/monitor/layerNames.ts:3-12`）。
7. モニター更新が最上位の `AppInner` を再描画し、訪問済みタブも残るため、アプリ全体が重くなる（`src/App.tsx:428,578-638`, `src/usePubSub.ts:20-23`）。
8. キーマップのファイル書き出しボタンが「保存」と表示され、本体への保存と区別できない（`src/keyboard/Keyboard.tsx:727-734`）。
9. ベースレイヤーを `layer.id === 0` と仮定しており、ファーム側のID次第で精密キーピッカーが機能しない（`src/trackball/PrecisionKeyPicker.tsx:29`）。

## Medium / Low の主な項目

- 精密キーの位置表現が非技術者向けではない。
- トーストに読み上げ用の `role` がなく、エラーも3秒で消える。
- 狭い画面でタブ名が消える一方、代替のアクセシブル名がない。
- 未保存状態が表示されない。
- `Raw HID`、`Studio RPC`、`&out OUT_USB`など技術用語が主文に出る。
- モニターの静的キー表にXがなく、実キーマップとも同期しない。
- Google Fontsの外部読み込みと日本語への等幅フォント適用が、起動速度と可読性を損なう。
- キーマップ読み込み時に最低500msの待機を強制している。
- Unlockモーダルから安全に脱出する操作がない。

## 優先順位トップ3

1. **デスクトップ版の右手USB接続体験と表示領域を成立させる。**
2. **精密モードの状態を `loading / available / disconnected / firmware-update-required / error` に分離し、誤表示と無限読み込みを止める。**
3. **英語エラー、日本語の保存用語、CPIと倍率の説明を統一する。**

## 評価された点

- 接続コーディネーターが「ポートが開いた」と「監視・編集が本当に使える」を分けている。
- revisionを使った競合防止と保存前検証がある。
- ポインター通知をフレーム単位で間引いている。
- プロトコル、状態機械、モニターストアのテストが厚い。
- キーが実際の`button`で実装され、基本的なアクセシビリティ属性を持つ。
- デバイスの確定値と編集中の下書きを混同していない。

## 実機・実行が必要な未検証事項

- 精密モード通知の実際の頻度とrevisionの変化。
- 800×600での正確な表示崩れ方。
- React Profilerによるフレームレートと入力遅延の実測。
- ファームが返す実レイヤーID、RIPとtrackball_settingsの共存状態。
- Xキーの実位置、左右接続情報の更新精度、VoiceOverの読み上げ。
