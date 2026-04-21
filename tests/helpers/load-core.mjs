// index.html から storage / engine / util の namespace を抽出し Node VM で実行するテストヘルパー。
//
// なぜ VM 抽出か:
// - 本プロジェクトは単一 HTML 配布を維持する方針（CLAUDE.md / SPEC §1.1）で、
//   ロジックを別 .mjs に切り出さない
// - Babel Standalone は import / export を解釈しないため、通常の ES モジュールとして
//   require できない
// - テスト側は Node で動くため、text/babel スクリプトから純 JS 部分のみを抜き出し、
//   localStorage / Math.random をスタブ化した VM context で評価して namespace を取り出す
//
// 取り出し単位は「// ── {section} ──」コメント区切り。section の順序・文言を
// 変える場合は本ローダと index.html の両方を同期更新する責任がある。

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..", "..");
const HTML = readFileSync(resolve(ROOT, "index.html"), "utf8");

const SCRIPT_RE = /<script\s+type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;
const scriptMatch = HTML.match(SCRIPT_RE);
if (!scriptMatch) {
  throw new Error("load-core: <script type=\"text/babel\"> が index.html に見つかりません");
}
const BABEL_SRC = scriptMatch[1];

function sliceBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`load-core: 開始マーカーなし: ${startMarker}`);
  const end = src.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`load-core: 終端マーカーなし: ${endMarker}`);
  return src.slice(start, end);
}

const STORAGE_SECTION = sliceBetween(BABEL_SRC, "// ── storage ──", "// ── engine ──");
const ENGINE_SECTION = sliceBetween(BABEL_SRC, "// ── engine ──", "// ── effects ──");

function makeFakeLocalStorage(initial = {}) {
  const mem = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    get length() { return mem.size; },
    key(i) {
      const keys = Array.from(mem.keys());
      return i >= 0 && i < keys.length ? keys[i] : null;
    },
    getItem(k) { return mem.has(k) ? mem.get(k) : null; },
    setItem(k, v) { mem.set(String(k), String(v)); },
    removeItem(k) { mem.delete(String(k)); },
    clear() { mem.clear(); },
    _mem: mem,
  };
}

// 数値 seed から再現可能な Math.random を作る。アルゴリズムは Numerical Recipes の LCG。
// 決定論テスト専用なので分布品質は問わない。
function makeSeededRandom(seed) {
  let state = (seed | 0) >>> 0;
  if (state === 0) state = 1;
  return function () {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Storage / Engine / Util / 関連定数を取り出す。
 *
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.initialStorage] - localStorage 初期値（key→string）
 * @param {number} [opts.randomSeed] - Math.random を LCG で差し替える。省略時はホスト Math.random
 * @returns {{
 *   Storage: object, Engine: object, Util: object,
 *   DEFAULT_SETTINGS: object,
 *   WRONG_WEIGHT_BOOST_PRESETS: ReadonlyArray<{value:number,label:string,desc:string}>,
 *   SESSION_LIMIT: number,
 *   localStorage: ReturnType<typeof makeFakeLocalStorage>,
 *   random: () => number,
 * }}
 */
export function loadCore(opts = {}) {
  const fakeLS = makeFakeLocalStorage(opts.initialStorage ?? {});
  const random = typeof opts.randomSeed === "number"
    ? makeSeededRandom(opts.randomSeed)
    : Math.random;

  const mathShim = Object.create(Math);
  mathShim.random = random;

  const sandbox = {
    localStorage: fakeLS,
    console: { warn: () => {}, log: () => {}, error: () => {}, info: () => {} },
    Math: mathShim,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Set,
    Map,
    Error,
    SyntaxError,
    Date,
  };
  vm.createContext(sandbox);

  const code = [
    STORAGE_SECTION,
    ENGINE_SECTION,
    // 末尾で公開したいシンボルを return 代わりに完成式にする
    ";({ Storage, Engine, Util, DEFAULT_SETTINGS, WRONG_WEIGHT_BOOST_PRESETS, SESSION_LIMIT });",
  ].join("\n");

  const exported = vm.runInContext(code, sandbox, { filename: "core-extracted.js" });
  return { ...exported, localStorage: fakeLS, random };
}
