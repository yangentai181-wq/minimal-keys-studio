# Task 4 report

- status: complete
- 変更: `ActionFeedbackLabel` を追加し、pending優先・成功時のみ装飾Check・grid/visibilityによる固定幅を実装。ヘッダー、Combo、精密モードの保存を `useTransientFeedback(800)` に接続し、明示的な `true` またはRPC/readback完了後だけ成功表示するようにした。接続成功Toastはdevice-info完了後だけ表示する。
- RED: `npm test -- src/motion/ActionFeedbackLabel.test.tsx src/trackball/TrackballPrecisionSettings.test.tsx`。終了コード 1。未実装importと「保存済み」不在を確認。
- GREEN: `npm test -- src/motion/ActionFeedbackLabel.test.tsx src/AppHeader.test.tsx src/App.disconnected.test.tsx src/combos/ComboSettings.test.tsx src/trackball/TrackballPrecisionSettings.test.tsx`。終了コード 0、5 files / 56 tests passed。
- build: `npm run build`。終了コード 0。
- lint: `npm run lint`。終了コード 0。
- commit: `feat: confirm successful save actions` (current HEAD)
- 自己レビュー: `onPress` の非同期呼出しはすべて `void` で明示し、ヘッダーは例外を捕捉。Comboは成功表示が見える800ms間のみ閉じるのを遅らせ、失敗・timeout・readback mismatchではtriggerしない。
- concerns: Viteの既存依存警告と500KB chunk警告は残るが、今回の変更による失敗ではない。

## Fix Round 1

- status: complete
- 変更: Combo保存の`closeAfterSave`/`useTransientFeedback`/`ActionFeedbackLabel`を撤去し、RPC成功とreadback一致後に直ちに編集フォームを閉じるよう復帰。成功は既存のCheck付きsuccess Toastのみで伝える。接続成功Toastのdevice-info完了後表示を成功ケースでも検証し、Comboのsuccess=false・timeout・readback mismatchでsuccess Toast不在を明示した。
- covering tests: `src/combos/ComboSettings.test.tsx`, `src/App.disconnected.test.tsx`
- RED: `npm test -- src/combos/ComboSettings.test.tsx src/App.disconnected.test.tsx`。終了コード 1。遅延closeにより新規draft回帰テストが失敗（加えて成功接続テストの不足mockを特定）。
- GREEN: `npm test -- src/combos/ComboSettings.test.tsx src/App.disconnected.test.tsx`。終了コード 0、2 files / 40 tests passed。
- full test: `npm test`。終了コード 0、92 files / 655 tests passed。
- lint: `npm run lint`。終了コード 0。
- build: `npm run build`。終了コード 0。
- commit: `fix: close combo editor after confirmed save` (current HEAD)
- 自己レビュー: 成功表示用タイマーと遅延effectを完全に除去し、新しい編集状態を過去のタイマーが閉じる経路をなくした。接続Toastは`connect()`がdevice-info取得を終えるまで呼ばれない。
- concerns: 全テスト出力のErrorBoundary由来console error、Viteの既存deprecated/chunk-size警告のみ。テスト・lint・buildはいずれも成功。
