# 🎯 kuku-dojo（九九どうじょう）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![offline](https://img.shields.io/badge/offline-100%25-green)](#-特徴)
[![single HTML](https://img.shields.io/badge/dist-single_HTML-blue)](#-ダウンロード)
[![Node](https://img.shields.io/badge/node-22%2B-green)](package.json)
[![tests](https://github.com/fk506cni/kuku-dojo/actions/workflows/test.yml/badge.svg)](.github/workflows/test.yml)

小学2〜3年生向け、**単一 HTML ファイルで動くオフライン九九練習アプリ**。
苦手な問題を自動で重点出題する**適応型学習アルゴリズム**と、
子供が楽しく続けられる**カラフルなエフェクト**を搭載。

![kuku-dojo 動作イメージ: 3×7 に正解した瞬間のコンボ演出](assets/screenshots/quiz-correct.png)

![kuku-dojo English UI: QuizScreen with combo on 6×4](assets/screenshots/quiz-en.png)

---

## 📥 ダウンロード

最新版の `kuku-dojo.html` は [Releases](../../releases) から入手できます。
ファイルをダウンロードしてダブルクリックするだけで起動します。インストール不要・オフライン動作。

---

## ✨ 特徴

- 📦 **単一 HTML ファイル** — ダウンロードしてダブルクリックするだけで起動
- 🌐 **完全オフライン** — サーバー・インターネット不要、個人情報も外部送信なし
- 🧠 **適応型出題** — 間違えた問題ほど出やすくなる（重み付き抽選）
- 👨‍👩‍👧 **マルチアカウント** — 兄弟・友達で 1 台を共有 OK
- 🎉 **子供向けエフェクト** — 紙吹雪・マスコット・効果音・コンボ演出
- 📊 **成績ダッシュボード** — 段別正答率・習熟度マップ・苦手ワースト 5
- ⏱️ **がんばった きろく** — 問題ごとの回答時間を可視化、「じかんもくひょう」4 プリセット (15s / 10s / 7s / 5s) で自分のペースを選べる
- 🌐 **多言語対応 (Languages: ja / en / zh-CN / zh-TW / ko / vi)** — ブラウザ言語を自動判定、せっていから手動切替も可能。最後に選んだ言語はログアウト後の Login 画面でも復元される（v1.3.0 で初期 6 言語フル展開 / Phase D で es / pt-BR を追加予定）。**zh-CN / zh-TW / ko / vi は機械翻訳ベース**で、ネイティブによる訳語の改善提案を [Issues](https://github.com/fk506cni/kuku-dojo/issues) で歓迎しています
- 🦻 **やさしい UI** — 大きな文字とボタン、ひらがな主体、色覚多様性に配慮

---

## 🚀 使い方（利用者向け）

1. `dist/kuku-dojo.html` をダブルクリックしてブラウザで開く
2. 「あたらしくつくる」からなまえを入力
3. ホーム画面で段と問題数を選び「はじめる」
4. 問題に答えると、苦手な問題がだんだん多く出るようになります

配布版 `dist/kuku-dojo.html` は**完全オフライン**で動作します。インターネット接続は一切不要、すべてのファイル（React / Tailwind / アプリ本体）が 1 つの HTML に埋め込まれています。

> ℹ️ 成績データはこのブラウザの localStorage に保存されます。ブラウザのデータを消去すると成績もリセットされる点にご注意ください。

> 📱 **Safari をご利用の場合**: Safari は `file://` で開いたページの localStorage をブラウザによって制限する場合があります。成績が保存されない場合は、下記「開発者向け」の `python3 -m http.server 8000` を使った起動を試してください。

---

## 🧑‍💻 開発者向け

### 必要なもの

- モダンブラウザ（Chrome / Edge / Firefox / Safari の最新版）
- **配布版ビルド / ユニットテスト実行時** Node.js **22+**（`package.json` の `engines` で宣言 / `--test-reporter=spec` と native glob の要件）
- 開発版 `index.html` を直接編集する場合は、初回起動時のみインターネット接続（Play CDN から React / Tailwind を読み込むため）
- （任意）簡易 HTTP サーバー: `python3 -m http.server 8000`
- 動作確認 OS: Linux / macOS（Windows のテストは未対応 / `package.json` の glob パターンが shell 挙動に依存）

### ディレクトリ構成

```
kuku-dojo/
├── index.html                           # 開発版（CDN 経由で動作、編集用）
├── dist/
│   └── kuku-dojo.html                   # 配布版（完全インライン、配布対象）
├── scripts/
│   └── build-dist.mjs                   # 配布版ビルドスクリプト
├── package.json                         # Node 依存とビルドコマンド
├── CLAUDE.md                            # AI アシスタント向けコンテキスト
├── SPEC.md                              # 技術仕様書
├── README.md                            # 本ファイル
├── prompts.md                           # ステップ実装用プロンプト集
└── docs/
    ├── startNN.md / reportNN.md         # 敵対的レビュー記録（gitignored）
    └── __archives/                      # 過去版（gitignored）
```

> `dist/` は `.gitignore` 済み。配布物は GitHub Releases 等で別途公開する運用を想定。

### 技術スタック（開発版 / 配布版）

| 用途 | 開発版 (`index.html`) | 配布版 (`dist/kuku-dojo.html`) |
|------|------|------|
| UI | React 18 (JSX) + Babel Standalone | React 18 production min + Babel CLI で事前コンパイル |
| スタイル | Tailwind CSS (Play CDN, JIT) | Tailwind CLI で使用クラスのみ抽出した CSS をインライン |
| 永続化 | localStorage | 同左 |
| エフェクト | Canvas + CSS Animation | 同左 |
| サウンド | Web Audio API (OscillatorNode) | 同左 |

配布版は実行時 JSX 変換・外部 fetch を一切行わないため、起動が高速でネットワーク不要です。

詳細は [SPEC.md](SPEC.md) §1.1 と §7 を参照。

### 配布版のビルド

```bash
npm install                # 初回のみ
npm run build              # → dist/kuku-dojo.html を生成
```

ビルドスクリプトは `scripts/build-dist.mjs` にあり、おおよそ次の処理を行います:

1. `npx tailwindcss` で `index.html` 内の使用クラスを抽出し、minify した CSS を生成
2. `index.html` 内の `<script type="text/babel">` を抜き出し、`@babel/preset-react` で JSX を JS に事前コンパイル
3. `node_modules` から `react.production.min.js` / `react-dom.production.min.js` をコピー
4. 上記 3 つを HTML テンプレートに `<style>` / `<script>` としてインライン埋め込み → `dist/kuku-dojo.html`

### 実装の進め方

[prompts.md](prompts.md) にステップ別の実装プロンプトとチェックリストをまとめています。
順に実行していけば段階的にアプリが完成します。Step 10 で配布版のビルドと最終テストを行います。

### 起動時間ベースライン

退行検知のため各 Step 完了時点の起動時間を記録します。計測指標と手順の詳細は [SPEC.md §6.1.1](SPEC.md) を参照。

本アプリは 2 つの指標を同時にログ出力します:

- **`js`**: `<script type="text/babel">` 先頭 → App マウントの区間（Babel 変換 + React 初回レンダ）。**headless Chrome でも安定**するため自動退行検知の主指標
- **`total`**: navigationStart → App マウントの全区間（HTML/CDN ダウンロード含む）。SPEC.md §6.1 の「5 秒以内」目標に対応。**実ブラウザで計測する必要あり**（headless では Chrome プロセスのオーバーヘッドで 15〜25 秒水増しされる）

**計測方法**:

1. **自動計測（js のみ / 退行検知用）**:
   ```bash
   ./scripts/measure_startup.sh --runs 3
   ```
   headless Chrome で 3 回計測し、`js` 値の統計を出力します。

2. **実ブラウザ計測（total を含む本物のベースライン）**:
   - 開発版 `index.html` を通常の Chrome/Edge/Firefox でダブルクリック起動
   - DevTools（F12）> Console タブを開く
   - `[kuku-dojo] startup: total=XXXms js=XXXms` のログを読む
   - シークレットウィンドウで開くと「初回」、同じウィンドウで F5 すると「2 回目以降」の値が得られる

**ベースライン表**:

| Step | 計測日 | 開発版 `js` (ms) | 開発版 `total` 初回 (ms) | 開発版 `total` 2 回目 (ms) | 配布版 `js` (ms) | 配布版 `total` (ms) | 備考 |
|------|--------|------------------|--------------------------|----------------------------|------------------|---------------------|------|
| Step 0（足場補完後） | 2026-04-15 | **6** ✅ (automated) | 実ブラウザで手動計測 | 実ブラウザで手動計測 | — | — | `useHash` + プレースホルダ 5 画面。`scripts/measure_startup.sh` で 3 回実行し `js=6,6,6 ms` の一致 |
| Step 3 | — | — | — | — | — | — | LoginScreen 実装後 |
| Step 5 | — | — | — | — | — | — | QuizScreen 実装後 |
| Step 7 | — | — | — | — | — | — | エフェクト統合後 |
| Step 10（配布版ビルド完成） | 2026-04-18 | **51** ✅ (automated) | 実ブラウザで手動計測 | 実ブラウザで手動計測 | **32** ✅ (automated) | 実ブラウザで手動計測 | 配布版は Babel 実行時変換なし・外部 fetch ゼロで `js` 32ms/`total` 45ms (headless、ダウンロード遅延ゼロ)。開発版は全機能実装後の値 |

> **目標値**:
> - `js`: 開発版 ≤ 1000 ms、配布版 ≤ 200 ms（自動退行検知）
> - `total`: 開発版 初回 ≤ 5000 ms / 2 回目以降 ≤ 3000 ms、配布版 ≤ 2000 ms（実ブラウザ計測）
>
> **退行検知の基点** (第11回レビュー C11-18 で改訂): Step 0 〜 Step 7 の全機能実装期間は機能追加に伴う `js` 増加が自然に発生するため、Step 毎の比較は行わない。Step 10（配布版ビルド完成）の開発版 `js=51ms` / 配布版 `js=32ms` を**以降の退行検知基点**とし、Step 11 以降の機能追加で +50% を超える退行が発生した場合のみそのセッション内で原因調査すること。

### 動作確認済みブラウザ

| ブラウザ | `file://` ダブルクリック起動 | `http://localhost` 起動 | 備考 |
|----------|------------------------------|--------------------------|------|
| Chrome（最新） | ✅ | ✅ | デスクトップ / Android |
| Edge（最新） | ✅ | ✅ | デスクトップ |
| Firefox（最新） | ✅ | ✅ | デスクトップ |
| Safari（macOS/iPadOS 最新） | ⚠ localStorage が保存されない場合あり | ✅ | iPad でも `http://localhost` 経由起動を推奨 |

配布版 `dist/kuku-dojo.html` のファイルサイズは v1.3.0 (Phase C / 6 言語) 時点で約 **426 KB**（React/ReactDOM production min + Tailwind 抽出 CSS + 事前コンパイル済み app.js + MESSAGES 6 言語込み）。1 MB 警告しきい値の約 41%。起動時間は headless Chrome で `total=45ms / js=32ms`、実ブラウザでも SPEC.md §6.1 の目標 2 秒以内を十分に満たします。

### 既知の制限事項

- **v1.0.0 の実機検証範囲**: v1.0.0 は自動検証（ビルドパイプライン / オフライン性 / 500KB サイズ / 起動時間）と **Windows Chrome / Edge** の実機動作確認を基準として刻印されています。macOS Safari / iPadOS Safari / Firefox / Android タブレット / 色覚シミュレータ / SR 実読み上げについては v1.0.x のパッチで順次検証します（SPEC.md §7.5 リリース基準 / `docs/__archives/report11.md` C11-01）。
- **Safari `file://` の localStorage 制限**: Safari は `file://` で開いたページの localStorage を制限することがあり、成績データが保存されない場合があります。回避策として `python3 -m http.server 8000` で起動し `http://localhost:8000/dist/kuku-dojo.html` を開いてください。
- **ブラウザデータ消去で成績消失**: 成績・設定・アカウント情報は利用者のブラウザ localStorage にのみ保存されます。ブラウザの「閲覧データの削除」や「シークレットモード」利用で全データが消失する点に注意してください。現時点ではデータエクスポート機能はありません（将来拡張予定）。
- **複数タブ同時起動は保証外**: 同一ブラウザで複数タブを開いた状態での挙動は未定義です。タブ間で state が乖離する可能性があります（SPEC.md §6.3）。
- **iOS Safari のエッジスワイプ back**: 試験中のエッジスワイプ back は確認ダイアログを経由せずに前画面に戻る場合がありますが、未完了セッションは保存されない仕様のため成績喪失以上の被害はありません（SPEC.md §4.3）。
- **Tailwind Play CDN 警告（開発版のみ）**: 開発版 `index.html` は Play CDN を使うため `should not be used in production.` の警告が出ますが、配布版 `dist/kuku-dojo.html` では出ません。

### 開発版コンソールに出る想定ログ・警告

開発版 `index.html` は Play CDN を使う性質上、以下のログが**仕様上必ず**出ます。`error` レベルの出力が無ければ正常です。

- `cdn.tailwindcss.com should not be used in production.` — Tailwind Play CDN の案内（配布版 `dist/kuku-dojo.html` では出ません）
- `You are running React in development mode...` — React dev build の案内
- `[kuku-dojo] startup: XXX ms` — 本アプリの起動時間計測ログ（info）

---

## 🗺️ 画面構成

```
[ログイン] → [ホーム] → [試験] → [結果サマリー]
              ↓
          [成績表示]
```

- **ログイン**: アカウント選択 / 新規作成
- **ホーム**: 段選択・問題数設定・試験開始・成績表示
- **試験**: 出題・テンキー入力・フィードバック
- **結果サマリー**: 正答率・所要時間・間違えた問題
- **成績表示**: 履歴一覧・段別正答率・習熟度マップ

---

## 🔒 プライバシー

- サーバー通信は一切行いません
- パスワードは不要（ニックネームのみ）
- 個人を特定する情報は保存しません
- すべてのデータは利用者のブラウザ内にのみ保存されます

---

## 🗓️ ロードマップ

v1.1.0 公開後の予定（優先度順、詳細は [SPEC.md §8](SPEC.md) 参照）:

- **v1.0.x / v1.1.x パッチ**: macOS Safari / iPadOS Safari / Firefox / Android タブレット等の実機検証を順次反映 + 配布物サイズ予算の見直し（500 KB → 1 MB zip）
- ✅ **v1.1.0**（2026-04-22 公開）: 回答時間の可視化と「じかんもくひょう」機能。Stats 画面の「がんばった きろく」タブで問題ごとの所要時間を可視化、4 プリセット 5〜15 秒（のんびり / ふつう / きびきび / たつじん）を選べる。適応出題アルゴリズム本体は変更なし（SPEC.md §8.8）。**「たつじん 5 秒」はお子さん自身が選ぶ前提のチャレンジ枠で、到達時は可視化のみ・未達でもペナルティは発生しません**（保護者による押し付け防止の設計配慮）
- ✅ **v1.2.0**（2026-04-25 公開）: 多言語対応 Phase A/B（`navigator.language` による自動判定 + せっていから手動切替）。日英 2 言語に対応、Login 画面の言語復元も実装。第18回敵対的レビュー対応 9 件 + ユーザー判断起点の Login 言語復元（案 A）込み（SPEC.md §8.9）
- ✅ **v1.3.0**（2026-04-25 公開）: 多言語対応 Phase C（zh-CN / zh-TW / ko / vi の 4 言語追加 — 初期 6 言語フル展開）。zh-HK/zh-MO/zh-SG の region variant + zh-Hans/zh-Hant の script tag フォールバック (Android 中華圏対応 / 第19回 C19-06) も実装。**4 言語は機械翻訳ベース**で公開し、ネイティブによる改善提案を Issues で募集
- **v1.4.0 以降**: 多言語対応 Phase D（es / pt-BR）。需要次第で進める。配布版サイズ予算（SPEC §7.4 の 1 MB zip）内で順次追加予定
- **その他**: 時間減衰 / 全網羅モード / データエクスポート（SPEC.md §8）

要望・フィードバックは [Issues](../../issues) へお気軽にどうぞ。

---

## 🤝 貢献・フィードバック

- バグ報告・要望は [Issues](../../issues) へ
- 小さな修正の PR 歓迎。大きな変更は先に Issue で相談してください
- AI アシスタント (Claude Code) とのペアプログラミングで各 Step ごとに敵対的レビューを挟みながら開発しました。開発フローの詳細は [`SPEC.md`](SPEC.md) / [`prompts.md`](prompts.md) / [`CLAUDE.md`](CLAUDE.md) を参照

---

## ☕ 応援について

kuku-dojo は個人開発のオフラインアプリで、MIT ライセンスで自由に使えます。
気に入っていただけたら応援 1 杯分のコーヒー代をいただけると嬉しいです（任意です）。

- 💖 [GitHub Sponsors](https://github.com/sponsors/fk506cni) — 継続的なサポート
- ☕ [Buy Me a Coffee](https://buymeacoffee.com/fk506cni) — 単発の応援
- 🎁 [OFUSE](https://ofuse.me/fk506cni) — お布施（日本発のサービス、文章付きで送れます）

リポジトリ右上の **Sponsor** ボタンからもまとめて一覧できます（[`.github/FUNDING.yml`](.github/FUNDING.yml)）。

バグ報告や「こどもがこう使っていた」というフィードバックも大歓迎です。

---

## 📜 ライセンス

[MIT License](LICENSE) — 自由に利用・改変・再配布できます。著作権表示とライセンス本文を成果物に含めてください。
