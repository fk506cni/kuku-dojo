# CLAUDE.md - AI Assistant Context

## Project Overview

**プロジェクト名**: kuku-dojo（九九どうじょう）
**概要**: 小学2〜3年生向けに、苦手問題を重点的に出題する適応型学習アルゴリズムを備えたオフライン九九練習Webアプリ。子供向けの楽しいエフェクトを随所に盛り込み、ゲーム感覚で学習できることを目指す。

### 名称の使い分け

| 文脈 | 使う表記 |
|------|------|
| リポジトリ名・コード・ファイル名・英語文脈 | `kuku-dojo` |
| README / ドキュメントの表示名 | `kuku-dojo（九九どうじょう）` |
| アプリ UI 内のタイトル表示（子供向け） | `くくどうじょう`（ひらがな） |
| 要件定義書のファイル名など、旧称が既に存在するもの | `九九練習アプリ`（そのまま残す） |

ドキュメントを新規作成する場合は上記の原則に従うこと。

## 🚨 v1.0.0 以降の公開運用ルール（最重要）

本レポジトリは 2026-04-19 に v1.0.0 として GitHub で **public 公開済み** (`https://github.com/fk506cni/kuku-dojo`)。以下は公開後の継続開発で必ず守ること。

### 1. コミットメールは GitHub noreply のみ

- 本レポジトリは `git config --local user.email="36837418+fk506cni@users.noreply.github.com"` を設定済み。触らない
- 実メール（`git config --global user.email` の値）は本レポジトリ内のファイル・新規 commit に一切含めない。具体的なアドレスはここに記載しない（漏洩防止）
- GitHub Settings → Emails の「Block command line pushes that expose my email」も有効化済み（二重防御）

### 2. main への force-push は封印

- v1.0.0 公開前に履歴初期化のため実施したが、以降は禁止
- 通常の `git push origin main`（fast-forward）のみ使用
- 例外: GitHub Support への dangling commits 削除依頼完了後の再初期化が必要な場合のみ、本人判断

### 3. gitignored だが公開しないファイル群

以下は `.gitignore` 登録済みで origin には push されない。`-f` でも push しないこと:

- `NOTES.md`（作者私的な開発メモ、次のセッション起動時の参照材料）
- `message.md` / `drafts/` / `jank/` / `refs/` / `__archives/`
- `docs/__archives/` / `docs/start*.md` / `docs/report*.md`（敵対的レビュー資材 / セッション開始プロンプト / レビュー報告書）
- `docs/publication_manual.md`（公開作業用マニュアル、著者の個人手順）
- `docs/九九練習アプリ_要件定義書.md`（元要件定義、旧称のまま残っているローカル参照資料）
- `scripts/commit-push.sh` / `scripts/archive_message.sh` / `scripts/backup.sh` / `scripts/stage-add.md`
- `scripts/upload_to_gdrive.sh`（著者個人の Google Drive アップロード、rclone remote 設定が個人依存）
- `node_modules/` / `dist/` / `dist-tmp/`

### 4. 敵対的レビューは `docs/__archives/report*.md` に蓄積

セッション開始プロンプト (`docs/start*.md`) / レビュー報告書 (`docs/report*.md`) は旧セッションごとに `docs/__archives/` に退避する運用。これらは gitignored なので origin には出ない。次回以降の Claude セッションでは `NOTES.md` と SPEC.md / CLAUDE.md / prompts.md を先に読めばよい。

### 5. バージョニング (SPEC.md §7.5)

- パッチ (`v1.0.x`): typo / 小バグ修正 / 実機検証の逐次消化
- マイナー (`v1.y.0`): 後方互換の機能追加（例: F1 回答時間 = v1.1.0 / F2 多言語 = v1.2.0）
- メジャー (`v2.0.0`): 破壊的変更（Settings 非互換マイグレーション等）
- `package.json` の version を single source of truth に、`scripts/build-dist.mjs` が自動参照する設計

## Quick Reference

### 配布形態

- **単一 HTML ファイル `dist/kuku-dojo.html`** で配布する。ダブルクリックでブラウザが開けば即起動する。
- **完全オフライン動作**。インターネット・サーバー・インストール不要。配布版は起動後の外部通信を一切行わない。
- 実装中は `index.html`（開発版、CDN 経由）で作業し、配布時にビルドスクリプトで `dist/kuku-dojo.html`（完全インライン版）を生成する **ハイブリッド 2 モード運用**。詳細は SPEC.md §1.1 / §7。
- ターゲット: 小学2〜3年生（7〜9歳）。ITリテラシーが低い前提でUIを設計する。

### Tech Stack

| 用途 | 開発版 (`index.html`) | 配布版 (`dist/kuku-dojo.html`) |
|------|------|------|
| UI | React 18 (JSX) + Babel Standalone で実行時変換 | React 18 production min をインライン。JSX は Babel CLI で事前コンパイル |
| スタイリング | Tailwind CSS Play CDN（JIT） | Tailwind CLI で使用クラスのみ抽出した CSS を `<style>` に埋め込み |
| 永続化 | localStorage（キー prefix `kuku_`） | 同左 |
| エフェクト | CSS Animation + Canvas | 同左 |
| サウンド | Web Audio API（`OscillatorNode` で生成） | 同左 |
| ビルド | 不要（ブラウザで直接開ける） | `npm run build` で `scripts/build-dist.mjs` 実行 |
| テスト | Node 22+ `node:test` + VM 抽出ローダ（追加依存なし）/ `npm test` | 同左（配布版はテスト不要） |

配布版の生成には Node 環境が必要だが、**利用者には Node は不要**。ビルド済み `dist/kuku-dojo.html` だけを配布する。

**ツール側の Node バージョン要件**: `npm test` / `npm run build` ともに **Node 22 以上**で動作確認済み（`package.json` の `engines` で宣言）。`--test-reporter=spec` は Node 20+、`node --test 'tests/**/*.test.mjs'` の positional glob は Node 21+ が必要。

### 開発時の動作確認

```bash
# 開発版: index.html を直接ブラウザで開く（Play CDN + Babel Standalone）
xdg-open index.html        # Linux
open index.html            # macOS

# CDN 経由スクリプトのキャッシュ問題 / Safari file:// 問題が出たら簡易サーバーで
python3 -m http.server 8000

# 配布版ビルド（Node 環境が必要）
npm install                # 初回のみ
npm run build              # → dist/kuku-dojo.html を生成

# 配布版の動作確認
xdg-open dist/kuku-dojo.html

# ユニットテスト実行（Node 22+ が必要、追加依存なし）
npm test                   # → node:test で tests/**/*.test.mjs を実行
```

テストは `tests/helpers/load-core.mjs` が `index.html` の `// ── storage ──` / `// ── engine ──` / `// ── helpers ──` セクションを VM 抽出して評価する方式。**Storage / Engine / Helpers レイヤを変更したら、対応する `tests/*.test.mjs` を同時に更新すること**。SessionResult スキーマや PROFICIENCY_META 等の UI 定義は screens セクションに残るため、テスト対象外（F1 以降に TS 拡張する場合も helpers 節への移設を前提とする）。

### Project Structure

```
kuku-dojo/
├── CLAUDE.md                # 本ファイル: AI アシスタント向けコンテキスト
├── SPEC.md                  # 技術仕様書
├── README.md                # ユーザー向け説明
├── prompts.md               # ステップ実装用プロンプト集
├── index.html               # アプリ本体（単一ファイル、開発版）
├── package.json             # Node 依存とビルドコマンド
├── dist/kuku-dojo.html      # 配布版（ビルドで生成、gitignored）
├── docs/                    # 敵対的レビュー資材は全て gitignored (start*.md / report*.md / __archives/)
├── tests/                   # node:test 用ユニットテスト（`npm test` で実行）
│   ├── helpers/load-core.mjs    # index.html の storage/engine/helpers 抽出ローダ
│   └── *.test.mjs               # 各レイヤのユニットテスト
└── scripts/
    ├── build-dist.mjs       # 配布版ビルドスクリプト
    ├── create_package.sh    # リリースパッケージ作成
    └── measure_startup.sh   # 起動時間計測
```

> ローカルには `docs/九九練習アプリ_要件定義書.md`（元要件、gitignored）、`scripts/upload_to_gdrive.sh`（著者個人の rclone 連携、gitignored）等が存在する場合がある。いずれも公開レポジトリには含まれない。

## Development Guidelines

### 最重要原則

1. **子供が一人で操作できること**。操作ステップは最少にし、ボタンは大きく、文字はひらがな主体。
2. **オフラインで動くこと**。外部 API・サーバー通信は禁止。CDN は許容するが将来インライン化する前提。
3. **エフェクトは「楽しいが集中を妨げない」**。1〜2 秒以内、色・音は穏やか〜中程度に。
4. **個人情報は保存しない**。ニックネームのみ。

### コーディング規約

- React は関数コンポーネント + Hooks のみ。
- スタイルは Tailwind ユーティリティクラスで完結させる。カスタム CSS は `<style>` ブロックに最小限。
- 型は JSDoc で記述する（`@typedef`）。
- ロジック層（出題エンジン・ストレージ）と UI 層は関数で分離する。`index.html` 内でも論理的にセクション分けする。
- すべての UI 文言は日本語・ひらがな主体。コメントは「なぜ」のみ書く。
- 状態管理は React 標準の useState / useReducer / Context のみ。外部ライブラリは入れない。

### localStorage 規約

| キー | 値 | 説明 |
|------|------|------|
| `kuku_accounts` | `Account[]` | アカウント一覧 |
| `kuku_weights_{accountId}` | `WeightMap` | 問題ごとの重み |
| `kuku_sessions_{accountId}` | `SessionResult[]` | セッション履歴 |
| `kuku_settings_{accountId}` | `Settings` | サウンド・エフェクト ON/OFF など |
| `kuku_welcomed` | `boolean` | 初回起動案内 (WelcomeNotice) 表示済みフラグ。device-level で運用（SPEC.md §2.1 参照） |
| `kuku_lang_preference` | `string` | 直近の確定 `Settings.lang` 生値 (`SUPPORTED_LANGS` 完全一致 / Phase B 時点 `"auto" \| "ja" \| "en"`)。device-level で運用、Login 画面の言語復元に使用（SPEC.md §2.1 / v1.2.0 Phase B 第18回ユーザー判断 案 A） |

すべての読み書きはラッパー関数（`loadAccounts` / `saveAccounts` 等）経由で行い、生 API を直接叩かない。

### 子供向けエフェクト方針

- **正解時**: 紙吹雪、星のパーティクル、マスコットの笑顔、効果音「ピンポーン」、励ましメッセージ。
- **不正解時**: マスコットがしょんぼり（怖がらせない、自己否定感を煽らない）、やわらかい音、正答を大きく表示、「おしい」等の寄り添う言葉。
- **連続正解**: コンボカウンター、3 連続で「すごい！」、5 連続で特別演出。
- **セッション完了**: 大きな紙吹雪 + ファンファーレ + 結果サマリーのアニメーション。
- **マスコット**: SVG または絵文字ベースの簡易キャラクター。仮称「くくちゃん」。状態遷移表は SPEC.md §5.3 を参照。
- **設定で OFF にできること**（教室・図書館での利用配慮）。

### 光過敏性（てんかん）配慮 — 必須要件

本アプリは不特定多数の子供が利用するため、光過敏性発作（PSE）のリスクを最小化する設計を**必須要件**とする。WCAG 2.3.1 に準拠する。

- 画面の 25% を超える面積で **3Hz を超える点滅を行わない**
- 強い白⇄黒の急峻な切替を避ける（フェード・色相変化で代替）
- ストロボ様の連続閃光・放射状ズームの連続発生は実装しない
- 個別エフェクトは 1.5 秒以内に終息させる
- 原色の高彩度ベタ塗りではなく、パステル調を基本とする

詳細と実装チェックリストは SPEC.md §5.0 を参照。**Step 5 の QuizScreen 基本実装の時点から意識すること**（Step 7 まで後回しにしない）。

### Naming Conventions

- React コンポーネント: `PascalCase`（`LoginScreen`, `QuizScreen`）
- 関数: `camelCase`（`pickQuestion`, `updateWeight`）
- localStorage キー: `kuku_*` プレフィックス
- アクセシビリティ最低ライン: 本文 16px 以上、問題表示 32px 以上、ボタン 48×48px 以上
  - **「本文」の定義** (第10回レビュー C10-05 で明文化): 操作対象 or 結果の**主要情報**を指す。具体例: 回答、スコア、段番号、履歴の日時・正答率、メッセージ本文、ボタンラベル、入力フィールド
  - **副次情報は 14px (`text-sm`) を許容**: 凡例、補助注記、カウンタ（例: 「10/10」）、スライダ両端の最小/最大値表示、タイムスタンプの秒表記など、主要情報を理解するための補助的表示
  - **12px (`text-xs`) は原則不使用**: マップ凡例や密度を要する表組み（9×9 マップの軸ラベル、凡例ピル等）でのみ許容。タブレット利用時の 7〜9 歳の可読性を最優先し、多用しない

### Tailwind クラスの記述ルール（配布版ビルドとの整合 — 必須）

配布版 `dist/kuku-dojo.html` は Tailwind CLI の `--content index.html` で使用クラスを抽出する。Tailwind CLI の抽出は**正規表現ベースの文字列マッチ**で行われるため、動的にクラス名を構築すると配布版 CSS で該当クラスが欠損してレイアウトが崩れる。以下を必ず守ること。

- **NG**（配布版で壊れる）:
  - ``className={`bg-${color}-500`}``（テンプレートリテラル変数展開）
  - `className={"bg-" + color + "-500"}`（文字列連結）
  - `className={classes.join(" ")}` のうち `classes` の要素が部分文字列で構築されているもの
- **OK**:
  - `className={isCorrect ? "bg-green-500 text-white" : "bg-red-200 text-red-900"}`（三項演算子の各枝に**完全な class 文字列**）
  - `className={["text-xl", dim && "text-slate-400"].filter(Boolean).join(" ")}`（各候補が完全な class 文字列）
  - `clsx` 系を使わず、React 標準の条件分岐で書ききる

参照: SPEC.md §7.2 ビルドパイプライン。第01回レビュー C01-04 で確立したルール。

**F2 I18n 導入後も本規約を継続**（第13回 C13-21 予防記述）: v1.2.0 で多言語対応を導入しても Tailwind クラス名の動的構築は引き続き禁止。言語別スタイル分岐が必要な場合（例: 右書き言語対応）は、三項演算子の各枝に完全な class 文字列を書くルールで対応する:

```js
// NG: クラス名を言語別に動的構築
className={`text-${lang === 'ar' ? 'right' : 'left'}`}

// OK: 各枝に完全な class 文字列
className={lang === 'ar' ? "text-right" : "text-left"}
```

F2 の MESSAGES は UI 文言データであり class 文字列ではないため本規約に抵触しない。ただし MESSAGES 内の英単語が Tailwind CLI で誤検出されるリスクは別途 SPEC §8.9.5 対策 A で対応する。

**PRESETS value を MESSAGES key に埋込むパターン**（第17回 C17-12 / SPEC §8.9.4 参照）: `Util.t("settings.wrongWeightBoost." + value + ".label")` のような key 構築で `String(value)` の JS 挙動に依拠することを許容する（`String(1.0)` === `"1"` / `String(0.5)` === `"0.5"`）。float value の末尾 `.0` drop と dot 連結による階層化揺れは「key 変換層を入れず `String(value)` で素直に引く」方針で簡素化優先。key 文字列のロックは `tests/util-t.test.mjs` で担保。

**tests/\*.mjs でも動的 class 文字列は禁止**（第14回 C14-24 予防記述）: 現状 `scripts/build-dist.mjs` の Tailwind CLI は `--content index.html` のみ走査するため tests はビルドに影響しないが、将来 JSX snapshot テストや Tailwind class 文字列 assertion が入った場合、tests 側で動的生成した class 文字列は配布版で欠損する。tests 側でも三項演算子の各枝に完全な class 文字列を書くルールを継続する。

### コード namespace 方針（Babel Standalone の ES Modules 非対応対策）

開発版 `index.html` の `<script type="text/babel">` は Babel Standalone で変換されるが、**Standalone は `import` / `export` を解釈しない**。全コードがグローバルスコープに並ぶため、名前衝突を避ける以下の規約に従うこと。

- **層ごとにオブジェクト namespace を使う**:
  - Storage 層: `const Storage = { loadAccounts, saveAccounts, ... };`
  - Engine 層: `const Engine = { pickQuestion, updateWeight, proficiencyLevel };`
  - Helpers 層: `const ResultHelpers = { ... };` / `const StatsHelpers = { ... };`（セッション結果の検証・整形・集計。React / JSX に依存しないピュア関数）
  - Effects 層: `const SoundPlayer = { ensureAudioContext, playCorrect, ... };`
- **React コンポーネント**: `PascalCase` でそのままグローバル（衝突リスクが低い）
- **共有ユーティリティ**: `const Util = { uuid, clamp, ... };` のように `Util` に集約
- **論理セクションコメント**: `index.html` 内で以下の順で固定配置する（実態に合わせた完全リスト / 第15回 C15-07）:
  1. `// ── types (JSDoc) ──` — 型定義ブロック
  2. `// ── storage ──` — Storage namespace（localStorage ラッパ）
  3. `// ── engine ──` — Engine namespace（出題 / 重み / 習熟度）
  4. `// ── helpers ──` — ResultHelpers / StatsHelpers 等のピュアヘルパ（第14回 C14-06 で新設）
  5. `// ── effects ──` — SoundPlayer 等の効果音 singleton
  6. `// ── effect components ──` — Confetti / Mascot 等の React 描画コンポーネント
  7. `// ── hooks ──` — カスタムフック
  8. `// ── context ──` — AppContext / Provider
  9. `// ── screens: LoginScreen ──` / `HomeScreen` / `QuizScreen` / `ResultScreen` / `StatsScreen` / `WelcomeNotice` のサブ節（第17回 C17-13 で未使用の `Placeholder` コンポーネントを削除。以前の `// ── screens (placeholders) ──` umbrella マーカーも同時除去）
  10. `// ── app (routing) ──` — ルーティング App コンポーネント
  11. `// ── mount ──` — ReactDOM.createRoot()
  - **load-core.mjs の VM 抽出対象**は上記のうち `storage` / `engine` / `helpers` / `effects` 4 節の bare マーカーのみ（`sliceBetween` は先頭 16 文字で prefix-match するため `// ── effects ──` と `// ── effect components ──` は別物として正しく切れる）
  - **マーカー同期責任**: `tests/helpers/load-core.mjs` が上記マーカー文字列に `indexOf` で依存しており、VM 抽出のセクション境界を決定する。マーカー文言を変更する場合（日本語化 / 命名変更等）は load-core.mjs も同期更新する責任がある（第14回 C14-08）

#### 呼び出し側の規律 — 必ず namespace 経由で書く（C03-09）

`function pickQuestion() {}` のような関数宣言は `<script>` のトップレベルで実行され、`Engine` オブジェクトに集約された後も**素の関数名がグローバルスコープに残存する**（`Engine.pickQuestion()` と素の `pickQuestion()` が両方とも呼び出し可能）。これは Babel Standalone の構造上の制約で、関数宣言を維持する限り完全には防げない。

呼び出し側の規律として以下を守ること:

- **必ず namespace 経由で呼ぶ**: `Engine.pickQuestion(...)` / `Storage.loadAccounts(...)` / `SoundPlayer.playCorrect()` のように書く。素の関数名（`pickQuestion(...)` 等）での呼び出しは禁止
- **コードレビュー時の検出**: namespace 経由でない呼び出しは grep で検出可能（例: `grep -nP '(?<![\w.])(pickQuestion|updateWeight|loadAccounts)\s*\(' index.html`）
- **アンダースコアプレフィックス**: namespace の内部関数（外から呼ぶことを想定しないもの）は `_readJSON` のようにアンダースコアで始める。これも漏洩自体は防げないが、規約として「外から呼ぶな」のサインになる
- **配布版ビルドとの整合**: Step 10 の Babel CLI 出力でも同じ漏洩が起こる前提で、呼び出し側の規律でカバーする方針。IIFE ラップは行わない（簡素な構造を優先）

参照: 第01回レビュー C01-03 / C01-09 / 第02回レビュー C02-06 / 第03回レビュー C03-09 で確立したルール。

### 宣言スタイル

- **関数宣言 (`function foo() {}`)**: ユーティリティ関数・React コンポーネント・カスタムフック（巻き上げが効く）
- **アロー関数 (`const bar = () => {}`)**: イベントハンドラ・短命クロージャ・`useCallback` / `useMemo` 内部
- **object method shorthand (`const Foo = { bar(x) { ... }, baz(y) { ... } };`)**: namespace オブジェクト内のメソッド（Storage / Engine / ResultHelpers / StatsHelpers / SoundPlayer 等）。`this` 不使用前提 / 巻き上げ不要 / ピュア関数を namespace に集約する場面で使う（第15回 C15-10）
- 関数宣言は定義順に依存しないため、ファイル内の配置は層（namespace）順を優先してよい

### 光過敏性配慮の実装チェックリスト（Step 5 以降で必ず確認）

SPEC.md §5.0 の WCAG 2.3.1 準拠を満たすため、カスタムアニメ追加時に以下を確認すること。

- [ ] `animation-duration` を 0.33 秒未満にしない（= 3Hz を超えない）
- [ ] 画面面積の 25% を超える要素に点滅・明滅アニメを付けない
- [ ] `animation-iteration-count: infinite` を使うのは呼吸や波紋等 1Hz 以下の穏やかな動きだけ
- [ ] 白⇄黒の急峻な切替を避け、フェード（opacity / color 補間）で代替
- [ ] `@media (prefers-reduced-motion: reduce)` で `animation: none;` に落とすフォールバックを併置
- [ ] Chrome DevTools の「Rendering > Emulate CSS media feature prefers-reduced-motion」で挙動を確認

参照: 第01回レビュー C01-16 で確立したルール。

## File Patterns to Ignore

- `__archives/`, `docs/__archives/`, `jank/`, `drafts/`, `refs/` - 退避・一時ファイル
- `dist/`, `dist-tmp/` - ビルド成果物・中間物
- `message.md` - 次回コミット用ドラフト（開発時のみ使用）
- `*.bak`, `*.swp`, `*~` - エディタ一時
- `.DS_Store`, `Thumbs.db` - OS
- `.idea/`, `.vscode/` - IDE
