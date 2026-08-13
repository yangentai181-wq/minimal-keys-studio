# minimal-keys App Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri版を唯一の正本アプリとして残し、旧Chromeアプリを復元可能な場所へ退避し、Git作業を変えずに再生成可能な成果物約5.2GBを削除する。

**Architecture:** 外部アプリの整理と開発成果物の削除を別タスクに分ける。各破壊的操作の直前に、絶対パス、シンボリックリンク、Git追跡状態を読み取り検証し、許可リストと一致した対象だけを操作する。Gitブランチ・worktree・未保存変更は読み取り比較のみ行う。

**Tech Stack:** macOS app bundle、Git worktree、Tauri build artifacts、zsh標準コマンド（`plutil`、`codesign`、`find`、`du`、`df`）。

## Global Constraints

- 正本アプリは `/Applications/minimal-keys カスタマイズ.app` とする。
- 旧Chromeアプリは完全削除せず、`/Users/iwanedaijun/.Trash/Minimal Keys Studio Chrome App (archived 2026-08-11).app` へ移動する。
- 完全削除は設計書に列挙された `dist` と `src-tauri/target` だけに限定する。
- メインの `.gitignore` と `work/`、全ブランチ、全worktree、`node_modules`、Firmware、UF2、キーマップ、Desktop・Downloadsの資料は変更しない。
- 許可リスト外のパス、シンボリックリンク、Git追跡ファイル、不明な対象を検出したら削除せず停止する。
- macOS GUIは操作せず、正本アプリはInfo.plistとコード署名だけを読み取り検証する。

---

### Task 1: 削除前スナップショットと安全条件の確認

**Files:**
- Read: `/Applications/minimal-keys カスタマイズ.app/Contents/Info.plist`
- Read: `/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app/Contents/Info.plist`
- Read: `/Users/iwanedaijun/repos/minimal-keys-studio/.gitignore`
- Read: `/Users/iwanedaijun/repos/minimal-keys-studio/work/`
- Modify: none

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-11-app-consolidation-design.md` の正本・許可リスト。
- Produces: 操作対象の実在、サイズ、Git状態、worktree一覧、ディスク空き容量の実行前証拠。

- [ ] **Step 1: 正本アプリの識別情報を確認する**

Run:

```bash
plutil -extract CFBundleIdentifier raw '/Applications/minimal-keys カスタマイズ.app/Contents/Info.plist'
plutil -extract CFBundleShortVersionString raw '/Applications/minimal-keys カスタマイズ.app/Contents/Info.plist'
codesign --verify --deep --strict '/Applications/minimal-keys カスタマイズ.app'
```

Expected: Bundle ID `com.hyhy-masa.minimal-keys-customize`、version `0.1.0`、`codesign` exit 0。

- [ ] **Step 2: 旧Chromeアプリが実ディレクトリであることを確認する**

Run:

```bash
test -d '/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app'
test ! -L '/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app'
plutil -extract CFBundleIdentifier raw '/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app/Contents/Info.plist'
```

Expected: 3コマンドともexit 0、Bundle ID `com.google.Chrome.app.phhfbfldihbifaoccelnbpoddfdpmgna`。

- [ ] **Step 3: Git状態とworktreeを記録する**

Run:

```bash
git -C '/Users/iwanedaijun/repos/minimal-keys-studio' status --short
git -C '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions' status --short
git -C '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl' status --short
git -C '/Users/iwanedaijun/repos/minimal-keys-studio' worktree list --porcelain
```

Expected: メインは ` M .gitignore` と `?? work/`、2つの既存worktreeはclean。worktree一覧にはメイン、`editor-hold-actions`、`ipad-unified-studio-impl`、この整理用worktreeがある。

- [ ] **Step 4: 削除候補にGit追跡ファイルがないことを確認する**

Run:

```bash
git -C '/Users/iwanedaijun/repos/minimal-keys-studio' ls-files 'dist/**' 'src-tauri/target/**'
git -C '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions' ls-files 'dist/**' 'src-tauri/target/**'
git -C '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl' ls-files 'dist/**' 'src-tauri/target/**'
```

Expected: 3コマンドともoutputなし、exit 0。1行でも出た場合はTask 3へ進まない。

- [ ] **Step 5: 対象サイズと空き容量を記録する**

Run:

```bash
du -sh '/Users/iwanedaijun/repos/minimal-keys-studio/dist' '/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target' '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist' '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target' '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist'
df -k '/Users/iwanedaijun'
```

Expected: 合計は概ね5.2GB。`df`の利用可能容量を最終比較用に記録する。

---

### Task 2: 旧Chromeアプリを復元可能な状態で退避

**Files:**
- Move: `/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app`
- To: `/Users/iwanedaijun/.Trash/Minimal Keys Studio Chrome App (archived 2026-08-11).app`

**Interfaces:**
- Consumes: Task 1のChrome Bundle ID確認。
- Produces: Applicationsから旧Chromeアプリを除き、ゴミ箱から復元できる退避物を残す。

- [ ] **Step 1: 退避先が空いていることを確認する**

Run:

```bash
test ! -e '/Users/iwanedaijun/.Trash/Minimal Keys Studio Chrome App (archived 2026-08-11).app'
```

Expected: exit 0。既に存在する場合は上書きせず停止する。

- [ ] **Step 2: Chromeアプリをゴミ箱へ移動する**

Run:

```bash
mv '/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app' '/Users/iwanedaijun/.Trash/Minimal Keys Studio Chrome App (archived 2026-08-11).app'
```

Expected: exit 0。

- [ ] **Step 3: 移動元と移動先を確認する**

Run:

```bash
test ! -e '/Users/iwanedaijun/Applications/Chrome Apps.localized/Minimal Keys Studio.app'
test -d '/Users/iwanedaijun/.Trash/Minimal Keys Studio Chrome App (archived 2026-08-11).app'
plutil -extract CFBundleIdentifier raw '/Users/iwanedaijun/.Trash/Minimal Keys Studio Chrome App (archived 2026-08-11).app/Contents/Info.plist'
```

Expected: 3コマンドともexit 0、Bundle ID `com.google.Chrome.app.phhfbfldihbifaoccelnbpoddfdpmgna`。

---

### Task 3: 許可リストの再生成可能成果物を削除

**Files:**
- Delete: `/Users/iwanedaijun/repos/minimal-keys-studio/dist`
- Delete: `/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target`
- Delete: `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist`
- Delete: `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target`
- Delete: `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist`
- Delete if present: `/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target`

**Interfaces:**
- Consumes: Task 1のGit追跡ファイルなし証拠と、設計書の絶対パス許可リスト。
- Produces: 再生成可能成果物が存在しない状態と、約5.2GBの容量回収。

- [ ] **Step 1: 各対象が実ディレクトリでシンボリックリンクではないことを確認する**

Run:

```bash
test -d '/Users/iwanedaijun/repos/minimal-keys-studio/dist' && test ! -L '/Users/iwanedaijun/repos/minimal-keys-studio/dist'
test -d '/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target' && test ! -L '/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target'
test -d '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist' && test ! -L '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist'
test -d '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target' && test ! -L '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target'
test -d '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist' && test ! -L '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist'
```

Expected: 各行exit 0。1つでも失敗した場合は削除せず再棚卸しする。

- [ ] **Step 2: 許可リストの5ディレクトリを完全削除する**

Run each command separately and confirm exit 0 before continuing:

```bash
find '/Users/iwanedaijun/repos/minimal-keys-studio/dist' -depth -delete
find '/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target' -depth -delete
find '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist' -depth -delete
find '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target' -depth -delete
find '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist' -depth -delete
```

Expected: 各コマンドexit 0。`find`は指定ディレクトリ自身まで削除する。

- [ ] **Step 3: ipad worktreeのTauri targetが存在する場合だけ削除する**

Run:

```bash
if test -e '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target'; then test -d '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target' && test ! -L '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target' && find '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target' -depth -delete; fi
```

Expected: exit 0。現在は対象が存在しないためno-opの見込み。

- [ ] **Step 4: 許可リスト対象が消えたことを確認する**

Run:

```bash
test ! -e '/Users/iwanedaijun/repos/minimal-keys-studio/dist'
test ! -e '/Users/iwanedaijun/repos/minimal-keys-studio/src-tauri/target'
test ! -e '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/dist'
test ! -e '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions/src-tauri/target'
test ! -e '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/dist'
test ! -e '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl/src-tauri/target'
```

Expected: 全コマンドexit 0。

---

### Task 4: 正本・Git状態・容量回収の最終検証

**Files:**
- Read: `/Applications/minimal-keys カスタマイズ.app/Contents/Info.plist`
- Read: Git status and worktree metadata
- Modify: none

**Interfaces:**
- Consumes: Tasks 1–3の完了状態。
- Produces: 正本1つ、旧版退避、成果物削除、Git無変更、容量回収の最終証拠。

- [ ] **Step 1: 正本アプリが維持されていることを確認する**

Run:

```bash
test -d '/Applications/minimal-keys カスタマイズ.app'
plutil -extract CFBundleIdentifier raw '/Applications/minimal-keys カスタマイズ.app/Contents/Info.plist'
plutil -extract CFBundleShortVersionString raw '/Applications/minimal-keys カスタマイズ.app/Contents/Info.plist'
codesign --verify --deep --strict '/Applications/minimal-keys カスタマイズ.app'
```

Expected: 全コマンドexit 0、Bundle ID `com.hyhy-masa.minimal-keys-customize`、version `0.1.0`。

- [ ] **Step 2: Applications上のminimal-keysアプリが正本だけであることを確認する**

Run:

```bash
find /Applications '/Users/iwanedaijun/Applications' -maxdepth 3 -type d -iname '*minimal*keys*.app' -print
```

Expected: `/Applications/minimal-keys カスタマイズ.app` のみ。ゴミ箱の退避物は検索対象外。

- [ ] **Step 3: Git状態とworktreeが実行前から変化していないことを確認する**

Run:

```bash
git -C '/Users/iwanedaijun/repos/minimal-keys-studio' status --short
git -C '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/editor-hold-actions' status --short
git -C '/Users/iwanedaijun/repos/minimal-keys-studio/.worktrees/ipad-unified-studio-impl' status --short
git -C '/Users/iwanedaijun/repos/minimal-keys-studio' worktree list --porcelain
```

Expected: メインは引き続き ` M .gitignore` と `?? work/`。2つの既存worktreeはcleanで、branch/worktree一覧に削除・追加がない。

- [ ] **Step 4: 空き容量の増加を確認する**

Run:

```bash
df -k '/Users/iwanedaijun'
```

Expected: Task 1の利用可能容量から概ね5.2GB増加。ファイルシステムの表示単位や同時書込みによる小さな差は実測値として報告する。

- [ ] **Step 5: 最終結果を報告する**

Report exactly:

```text
- 正本: minimal-keys カスタマイズ.app / com.hyhy-masa.minimal-keys-customize / 0.1.0
- 旧Chrome版: ゴミ箱へ移動済み（復元可能）
- 完全削除: 許可リスト内の再生成可能なdist/targetのみ
- 回収容量: dfの実測差
- Git: メインの既存変更と2つの未統合worktreeを維持
- 未実施: ブランチ削除、worktree削除、Firmware/キーマップ整理、Storybook修正
```

Expected: 実測値と一致し、不確実な項目を完了扱いにしない。
