# キー候補一覧の縦スクロール修正 設計

**日付:** 2026-08-10

**状態:** ユーザー承認済み

**対象:** `minimal-keys-studio`

## 目的

キー割当画面で候補が表示領域より多い時に、下側の候補へ到達できない問題を直す。タブ見出しと現在のキーボード表示を維持し、候補内容だけを縦スクロールできるようにする。

## 確認した原因

現在の高さ制約は次のようになっている。

1. `Keyboard` のpicker外枠は `min-h-0 overflow-hidden`。
2. `BehaviorBindingPicker` と `PickerTabs` は縦flexで残り高さを受け取る。
3. `PickerTabs` のtab contentは `min-h-0 flex-1` だが、`overflow-y-auto` を持たない。
4. 各tabの中にも縦スクロール担当がない。

外枠が内容を切り取り、内側にもscroll ownerがないため、wheel、trackpad、touch、キーボードのどれでも下側へ移動できない。既存testが `overflow-y-auto` を持たないことを期待しており、不具合を固定している。

## 採用方針

`PickerTabs` の候補content panelを唯一の縦scroll ownerにする。

- 上段・下段のタブ見出しは固定する。
- 候補contentへ `min-h-0 flex-1 overflow-y-auto overscroll-contain` を付ける。
- scrollbar出現で横幅が揺れないよう、対応環境ではstable gutterを使う。
- 外側の `Keyboard` は現在の高さ分配と `overflow-hidden` を維持する。
- 各tab componentには個別のscroll containerを追加しない。

外枠全体をスクロールさせる案はタブ見出しまで消えるため採用しない。各tabが別々にoverflowを持つ案も、二重scrollと実装差を生むため採用しない。

## 操作仕様

- wheel／trackpad操作はpointerが候補領域上にある時、その候補領域だけを縦移動する。
- touch dragでも同じ領域を移動できる。
- Tabキーで画面外の候補へfocus移動した時は、browser標準のscroll-into-viewで候補が見える位置へ移動する。
- タブを切り替えた時は、新しいカテゴリを先頭から見られるようscrollTopを0へ戻す。
- 現在のタブ選択、カテゴリ選択、割当結果はscroll位置変更では変化しない。
- 横スクロールは発生させず、候補gridは現在のresponsive column数を使う。

## 既存設計との関係

`2026-08-06-compact-monitor-hold-decision-design.md` は、標準画面で主要候補が可能な限り同時表示されることを求めている。本修正はその高さ配分を維持する。

ただし、候補数、翻訳文字列、OS別項目、利用可能なBehaviorによって内容が領域を超える場合に切り捨てることは認めない。その場合の安全なfallbackとして内部縦スクロールを使う。本設計が「overflow時にもscrollを持たない」という既存test期待を置き換える。

## アクセシビリティ

- 現在のbutton群とclickによるタブ切替構造を維持し、scroll修正によってfocus順を変えない。
- scroll領域へ不要なtab stopを追加しない。
- focus ringをoverflowで切らないため、content内側へ必要最小限の余白を保つ。
- scrollbarだけに依存せず、wheel、touch、キーボードfocus移動を利用できるようにする。
- `prefers-reduced-motion` に反するsmooth scrollは追加しない。

## テスト

コード変更をRED→GREENのTDDで行う。

- 既存testの「content panelにoverflowがない」期待を、唯一の `overflow-y-auto` がcontent panelにある期待へ変更する。
- 外枠とtab見出しがscroll ownerにならないことを固定する。
- 高さを制限したfixtureで、先頭と最後の候補が同じtabpanel内に存在し、content panelがscroll contractを持つことを確認する。
- タブ切替時にscrollTopが0へ戻ることを確認する。
- tab切替、候補選択、修飾キー、layer、shortcutの既存testを回帰実行する。
- Storybookまたは実アプリで800×600、1200×800の表示を確認する。
- mouse wheel、Mac trackpad、キーボードTabで最後の候補まで到達できることを手動確認する。
- 横スクロール、二重scroll、タブ見出しの消失がないことを確認する。

## 非目標

- pickerのカテゴリ構成や候補順の変更
- 候補の検索機能や仮想化
- アプリ全体のscroll設計変更
- キーボード図や接続statusの再配置
- 色、余白、フォントの全面再デザイン

## 完了条件

1. 候補が表示領域を超えても最後まで到達できる。
2. タブ見出しは固定され、候補部分だけが縦スクロールする。
3. wheel、trackpad、touch、キーボードfocusで操作できる。
4. 二重scrollと横スクロールが発生しない。
5. 関連test、全test、build、lint、Tauri buildが終了コード0になる。
