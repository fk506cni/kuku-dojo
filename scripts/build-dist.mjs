#!/usr/bin/env node
/**
 * scripts/build-dist.mjs
 *
 * 開発版 index.html から配布版 dist/kuku-dojo.html を生成するビルドスクリプト。
 *
 * 手順:
 *   1. index.html を読み込む
 *   2. <script type="text/babel">...</script> の中身を抜き出し、
 *      @babel/core transformSync で JSX → JS に事前コンパイル
 *   3. Tailwind CLI で使用クラスのみの CSS を抽出 (--content index.html --minify)
 *   4. node_modules の React / ReactDOM production min を読み込む
 *   5. index.html から CDN <script> を除去し、上記 3 つをインライン埋め込み
 *   6. Step 9 で決定した CSP meta (SPEC.md §7.2.2) を追加
 *   7. dist/kuku-dojo.html に書き出し、ファイルサイズを表示
 *      (SPEC §7.4: 非圧縮 3 MB 未満 HARD FAIL / 1 MB 以上で WARN。第13回 C13-01 で v1.0.x 更新)
 *
 * 参照: SPEC.md §7.2 ビルドパイプライン / §7.2.1 Tailwind --content 制約 / §7.2.2 CSP
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_HTML = resolve(ROOT, "index.html");
const DIST_DIR = resolve(ROOT, "dist");
const DIST_TMP = resolve(ROOT, "dist-tmp");
const OUT_HTML = resolve(DIST_DIR, "kuku-dojo.html");
const PACKAGE_JSON = resolve(ROOT, "package.json");
const REACT_PROD = resolve(ROOT, "node_modules/react/umd/react.production.min.js");
const REACTDOM_PROD = resolve(ROOT, "node_modules/react-dom/umd/react-dom.production.min.js");
const TAILWIND_BIN = resolve(
  ROOT,
  "node_modules/.bin",
  process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss"
);
// SPEC §7.4 (第12回 C12-20 / C12-23 + 第13回 C13-01 を受け v1.0.x で更新): 非圧縮 3 MB 未満
// = HARD FAIL 閾値。1 MB は zip 同梱時の「警告しきい値」として WARN_BUDGET で併記。
// F2 Phase D 8 言語フル実装 +80〜100 KB / source map inline +30〜40% を吸収できる余裕枠。
const SIZE_BUDGET = 3 * 1024 * 1024;
const WARN_BUDGET = 1 * 1024 * 1024;
// C11-07: VERSION は package.json を single source of truth として参照する。
// リテラル二重管理 (build-dist.mjs / package.json) によるドリフトを避ける。
const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
const VERSION = pkg.version || "0.0.0-unknown";

function log(...args) {
  console.log("[build]", ...args);
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function assertFile(p, hint) {
  if (!existsSync(p)) {
    throw new Error(`必要なファイルが見つかりません: ${p}\n  → ${hint}`);
  }
}

// ── 0. I18n 検査 (v1.2.0 Phase B / 第13回 C13-13) ────────────────────
// MESSAGES の言語間キー一致を validate-i18n.mjs で検査。missing / extra が
// 検出されたら execFileSync が非 0 exit を throw し、ビルドを停止させる。
// SPEC §7.2.1.1 同期責任表: build-dist.mjs と validate-i18n.mjs は MESSAGES_RE を共有。
log("I18n キー一致検査 (validate-i18n.mjs)");
execFileSync(process.execPath, [resolve(__dirname, "validate-i18n.mjs")], { stdio: "inherit" });

// ── 1. index.html 読み込み ───────────────────────────────────────────
log("読み込み: index.html");
const html = readFileSync(SRC_HTML, "utf8");

// ── 2. <script type="text/babel"> 抽出 & JSX → JS 変換 ───────────────
const babelScriptRe = /<script\s+type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;
const babelMatch = html.match(babelScriptRe);
if (!babelMatch) {
  throw new Error("index.html に <script type=\"text/babel\"> が見つかりません");
}
const jsxSource = babelMatch[1];
log(`babel script 抽出: ${jsxSource.length.toLocaleString()} 文字`);

log("JSX → JS 変換 (@babel/preset-react runtime=classic)");
const transformResult = babel.transformSync(jsxSource, {
  presets: [["@babel/preset-react", { runtime: "classic" }]],
  babelrc: false,
  configFile: false,
  sourceType: "script",
  filename: "kuku-app.jsx",
  compact: false,
});
if (!transformResult || typeof transformResult.code !== "string") {
  throw new Error("babel.transformSync が code を返しませんでした");
}
let appJs = transformResult.code;
log(`変換後 app.js: ${appJs.length.toLocaleString()} 文字`);

// C11-11 (旧 C10-16): 配布版では `[kuku-dojo]` 名前空間の console.info を抑止する。
// 開発版では起動時間計測用に `console.info("[kuku-dojo] startup:", ...)` を出力するが、
// エンドユーザー (小 2-3 年の子供と保護者) のコンソールには必要ない情報。
// プロジェクト規約で console.info は `[kuku-dojo] ` prefix 付きのみ使う運用なので prefix マッチで安全に除去できる。
// console.warn / console.error は保持する (ストレージエラー等の警告経路)。
const consoleInfoRe = /console\.info\(\s*"\[kuku-dojo\][\s\S]*?\);?\s*/g;
const beforeInfoLen = appJs.length;
appJs = appJs.replace(consoleInfoRe, "/* console.info stripped in dist (C11-11) */\n");
if (appJs.length !== beforeInfoLen) {
  log(`console.info 除去: ${(beforeInfoLen - appJs.length).toLocaleString()} 文字削減`);
} else {
  log("console.info 除去: 対象なし (index.html 側で削除済みか、prefix が変わった可能性)");
}

// ── 3. Tailwind CSS 生成 ────────────────────────────────────────────
ensureDir(DIST_TMP);
const INPUT_CSS = resolve(DIST_TMP, "input.css");
const OUT_CSS = resolve(DIST_TMP, "tailwind.css");
writeFileSync(INPUT_CSS, "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");

// SPEC §8.9.5 対策 A: Tailwind CLI は `--content` の文字列リテラルを正規表現でスキャン
// するため、MESSAGES JSON 内の英単語 ("border" / "flex" 等) が utility class として誤検出
// され配布版 CSS が肥大化する (C12-08)。CLI に渡す前に MESSAGES 本体を空 JSON に置換した
// 一時 HTML を生成し、それを --content に渡す。dist 出力には MESSAGES 本体は含まれる。
// 第17回 C17-06: 属性追加 (`data-version="1"` 等) で silent にマッチ不成立する退行を避けるため
//   `[^>]*>` で属性拡張許容。tests/helpers/load-core.mjs の SCRIPT_RE と命名規則を揃える。
const MESSAGES_RE = /<script\s+type="application\/json"\s+id="kuku-messages"[^>]*>[\s\S]*?<\/script>/;
if (!MESSAGES_RE.test(html)) {
  throw new Error(
    "index.html に <script type=\"application/json\" id=\"kuku-messages\"> が見つかりません。\n" +
    "  F2 多言語対応 (SPEC §8.9) の MESSAGES 分離配置が崩れている可能性があります。"
  );
}
const indexForTailwind = resolve(DIST_TMP, "index-for-tailwind.html");
const htmlForTailwind = html.replace(
  MESSAGES_RE,
  '<script type="application/json" id="kuku-messages">{}</script>'
);
writeFileSync(indexForTailwind, htmlForTailwind);

assertFile(TAILWIND_BIN, "npm install を先に実行してください");
log("Tailwind CLI 実行 (--content <MESSAGES 空化版> --minify)");
execFileSync(
  TAILWIND_BIN,
  ["-i", INPUT_CSS, "-o", OUT_CSS, "--content", indexForTailwind, "--minify"],
  { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] }
);
const tailwindCss = readFileSync(OUT_CSS, "utf8");
log(`Tailwind CSS 生成: ${tailwindCss.length.toLocaleString()} 文字`);

// 3-b. smoke test (SPEC.md §7.2.1) — 既知必須クラスの欠損を即検知する
// minified Tailwind は `.bg-white\/70{...}` のように `/` を CSS エスケープする。
// 正規表現リテラルで書く: `\\\/` = 「literal バックスラッシュ + literal スラッシュ」。
const REQUIRED_PATTERNS = [
  /bg-white\\\/70/,
  /backdrop-blur/,
  /from-slate-50/,
  /to-indigo-100/,
  /bg-gradient-to-br/,
];
const missing = REQUIRED_PATTERNS.filter((re) => !re.test(tailwindCss));
if (missing.length > 0) {
  throw new Error(
    `Tailwind 抽出 smoke test 失敗: ${missing.map((r) => r.source).join(", ")} が出力 CSS に含まれていません。\n` +
      "  動的クラス名構築 (テンプレートリテラル変数展開・文字列連結) を使っていないか確認してください。\n" +
      "  参照: CLAUDE.md Tailwind クラスの記述ルール / SPEC.md §7.2.1"
  );
}
log("Tailwind smoke test: OK");

// ── 4. React / ReactDOM production min ──────────────────────────────
assertFile(REACT_PROD, "npm install で react@18.2.0 を入れてください");
assertFile(REACTDOM_PROD, "npm install で react-dom@18.2.0 を入れてください");
const reactProd = readFileSync(REACT_PROD, "utf8");
const reactDomProd = readFileSync(REACTDOM_PROD, "utf8");
log(`React prod: ${reactProd.length.toLocaleString()} 文字 / ReactDOM prod: ${reactDomProd.length.toLocaleString()} 文字`);

// ── 5. HTML テンプレート組み立て ────────────────────────────────────
let distHtml = html;

// 5-a. 先頭コメント (バージョン / ビルド日 / ライセンス) を配布版に差し替え
// C11-08: MIT ライセンスは「著作権表示とライセンス本文を成果物に含める」義務があるため、
// 単体 HTML として配布される場合に備えてヘッダコメントに表記を含める。
// また、React (MIT, Copyright Meta Platforms) / Tailwind CSS (MIT, Copyright Tailwind Labs)
// のインライン同梱もここで告知する。
const buildDate = new Date().toISOString().slice(0, 10);
const headerComment =
  "<!--\n" +
  "  kuku-dojo (くくどうじょう) - 九九練習アプリ\n" +
  `  Version: ${VERSION} (配布版 / dist/kuku-dojo.html)\n` +
  `  Build:   ${buildDate} (scripts/build-dist.mjs による自動生成)\n` +
  "\n" +
  "  本ファイルは index.html から JSX 事前コンパイル + Tailwind CLI + React UMD インライン化で生成された\n" +
  "  完全オフライン配布版です。起動後の外部通信は一切行いません。\n" +
  "  編集する場合は開発版 index.html を直接触り、`npm run build` で再生成してください。\n" +
  "\n" +
  "  License: MIT License.\n" +
  "    kuku-dojo   - Copyright (c) 2026 fk506cni\n" +
  "    React / ReactDOM - Copyright (c) Meta Platforms, Inc. and affiliates (MIT)\n" +
  "    Tailwind CSS     - Copyright (c) Tailwind Labs, Inc. (MIT)\n" +
  "  フルライセンス本文はプロジェクトの LICENSE ファイル、および本バンドル内の\n" +
  "  React / Tailwind コード冒頭のライセンスヘッダを参照してください。\n" +
  "-->";
// C11-03: `<!-- KUKU-HEADER-START -->` ... `<!-- KUKU-HEADER-END -->` の明示マーカー間を置換する。
// 以前は `/<!--[\s\S]*?-->\s*/` で「最初に現れた HTML コメント」を貪欲捕捉していたが、
// doctype 直後に別コメントを挟むと誤爆するリスクがあった。マーカー方式で堅牢化。
const headerMarkerRe = /<!-- KUKU-HEADER-START -->[\s\S]*?<!-- KUKU-HEADER-END -->\s*/;
if (!headerMarkerRe.test(distHtml)) {
  throw new Error("index.html に <!-- KUKU-HEADER-START --> ... <!-- KUKU-HEADER-END --> マーカーが見つかりません");
}
distHtml = distHtml.replace(headerMarkerRe, () => headerComment + "\n");

// 5-b. CDN <script> 4 本とその案内コメントをまとめて除去
// C11-10: 以前は 4 本の CDN <script> の固定順序・属性に依存した一括 regex だったが、
// `<!-- KUKU-CDN-START -->` ... `<!-- KUKU-CDN-END -->` マーカーで囲み順序非依存にする。
const cdnMarkerRe = /\n\s*<!-- KUKU-CDN-START -->[\s\S]*?<!-- KUKU-CDN-END -->/;
if (!cdnMarkerRe.test(distHtml)) {
  throw new Error("index.html に <!-- KUKU-CDN-START --> ... <!-- KUKU-CDN-END --> マーカーが見つかりません");
}
distHtml = distHtml.replace(
  cdnMarkerRe,
  () => "\n    <!-- 配布版: Tailwind / React / ReactDOM / Babel 変換結果は下の <style> / <script> にインラインされる -->"
);

// 5-c. CSP meta を <meta name="referrer"> の直後に挿入 (SPEC.md §7.2.2)
const cspMeta =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\';">';
distHtml = distHtml.replace(
  /(<meta name="referrer" content="no-referrer" \/>)/,
  `$1\n    ${cspMeta}`
);

// 5-d. Tailwind <style> を既存 <style> ブロックの直前に挿入
// replacer は関数形式で書く (CSS に `$` が含まれても特殊パターン扱いにならないように)。
const tailwindStyleBlock =
  `<style id="kuku-tailwind">${tailwindCss}</style>`;
distHtml = distHtml.replace(
  /(\n\s*<!-- SPEC\.md §5\.0)/,
  (_m, pre) => `\n    ${tailwindStyleBlock}${pre}`
);

// 5-e. <script type="text/babel"> を React / ReactDOM / 事前コンパイル済み app.js に差し替え
// 関数形式の replacer を使うのは必須: React prod minified に含まれる `$&` 等の
// 特殊置換パターンが文字列 replacer で展開されて出力が破損するため (`$&` = マッチ全体)。
const inlineScripts =
  `<script>${reactProd}</script>\n` +
  `    <script>${reactDomProd}</script>\n` +
  `    <script>\n${appJs}\n    </script>`;
distHtml = distHtml.replace(babelScriptRe, () => inlineScripts);

// ── 6. 書き出し ─────────────────────────────────────────────────────
ensureDir(DIST_DIR);
writeFileSync(OUT_HTML, distHtml, "utf8");
const size = statSync(OUT_HTML).size;
const sizeKb = size / 1024;
log(`生成: ${OUT_HTML}`);
log(`ファイルサイズ: ${size.toLocaleString()} bytes (${sizeKb.toFixed(1)} KB)`);
log(`警告しきい値 (zip 同梱目安 1 MB): ${WARN_BUDGET.toLocaleString()} bytes (${(WARN_BUDGET / 1024).toFixed(0)} KB)`);
log(`FAIL 閾値 (非圧縮 3 MB):          ${SIZE_BUDGET.toLocaleString()} bytes (${(SIZE_BUDGET / 1024).toFixed(0)} KB)`);

if (size >= SIZE_BUDGET) {
  console.error(`[build] ERROR: ファイルサイズが FAIL 閾値 ${(SIZE_BUDGET / 1024).toFixed(0)}KB を超えました (SPEC §7.4)`);
  process.exit(1);
}
if (size >= WARN_BUDGET) {
  console.warn(`[build] WARN: ファイルサイズが zip 同梱目安 ${(WARN_BUDGET / 1024).toFixed(0)}KB を超えています (SPEC §7.4)`);
}

// ── 7. 仕上げ smoke test: 配布物に外部 URL が残っていないこと ──────
const leakPatterns = [
  /https?:\/\/cdn\.tailwindcss\.com/,
  /https?:\/\/unpkg\.com\/react/,
  /https?:\/\/unpkg\.com\/react-dom/,
  /https?:\/\/unpkg\.com\/@babel\/standalone/,
];
const leaks = leakPatterns.filter((re) => re.test(distHtml));
if (leaks.length > 0) {
  throw new Error(
    "配布物に CDN URL が残っています: " + leaks.map((r) => r.source).join(", ")
  );
}
log("外部 URL リーク検査: OK (CDN 参照ゼロ)");

// ── 8. dist-tmp/ 中間生成物のクリーンアップ (C11-19) ─────────────────
// Tailwind CLI への入出力ファイル (input.css / tailwind.css) は配布物に影響しない中間物。
// 正常終了時は掃除しておくと CI 環境でのディスク圧迫を避けられる。
// 異常終了時 (例外経路) は次回ビルドで writeFileSync が上書きするので残置しても無害。
try {
  rmSync(DIST_TMP, { recursive: true, force: true });
  log("dist-tmp/ クリーンアップ: OK");
} catch (e) {
  // クリーンアップ失敗はビルド結果に影響しないため警告のみ
  console.warn("[build] dist-tmp/ のクリーンアップに失敗:", e.message);
}

log("完了 ✓");
