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

// 注: g フラグなしで最初の <script type="text/babel"> のみを抽出する（C14-07）。
// 現状 index.html には text/babel script は 1 本のみだが、将来 2 本目が追加された場合に
// silent に wrong slice する前に本ローダ側を再設計する必要がある。
// F2 の MESSAGES は <script type="application/json"> なので本 regex にマッチしない（安全）。
const SCRIPT_RE = /<script\s+type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;
const scriptMatch = HTML.match(SCRIPT_RE);
if (!scriptMatch) {
  throw new Error("load-core: <script type=\"text/babel\"> が index.html に見つかりません");
}
const BABEL_SRC = scriptMatch[1];

// マーカー抽出契約（C14-09）:
// - マーカー文字列は index.html 内で「コメントとしてのみ」出現することを前提とする
// - 文字列リテラル / テンプレート / JSX テキストノードに同文字列が混入すると
//   最初の出現を掴んで wrong slice する可能性がある
// - マーカーの一覧と同期責任は CLAUDE.md §コード namespace 方針に記載
function sliceBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`load-core: 開始マーカーなし: ${startMarker}`);
  const end = src.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`load-core: 終端マーカーなし: ${endMarker}`);
  return src.slice(start, end);
}

const STORAGE_SECTION = sliceBetween(BABEL_SRC, "// ── storage ──", "// ── engine ──");
const ENGINE_SECTION = sliceBetween(BABEL_SRC, "// ── engine ──", "// ── helpers ──");
const HELPERS_SECTION = sliceBetween(BABEL_SRC, "// ── helpers ──", "// ── effects ──");

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
// 決定論テスト専用なので分布品質は問わない（テスト時の決定論担保のみが目的で、
// 本番 Math.random 挙動の近似ではない / C14-10）。
// seed=0 を渡すと LCG が 0 で stuck するため、内部で 1 に振替する（C14-26）。
function makeSeededRandom(seed) {
  let state = (seed | 0) >>> 0;
  if (state === 0) state = 1;
  return function () {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Storage / Engine / Helpers / Util / 関連定数を取り出す。
 *
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.initialStorage] - localStorage 初期値（key→string）
 * @param {number} [opts.randomSeed] - Math.random を LCG で差し替える。seed=0 は内部で 1 に振替
 *                                     （LCG が 0 で stuck するため）。省略時はホスト Math.random
 * @returns {{
 *   Storage: object, Engine: object, Util: object,
 *   I18n: { messages: Record<string, Record<string,string>>, current: null|string },
 *   ResultHelpers: object, StatsHelpers: object,
 *   DEFAULT_SETTINGS: object,
 *   WRONG_WEIGHT_BOOST_PRESETS: ReadonlyArray<number>,
 *   SLOW_THRESHOLD_PRESETS: ReadonlyArray<number>,
 *   SESSION_LIMIT: number,
 *   STATS_RECENT_N: number,
 *   COLD_START_COUNT: number,
 *   STATS_RESPONSE_TIME_SAMPLES: number,
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

  // VM sandbox に注入する intrinsics。index.html の storage / engine / helpers セクションが
  // 使う可能性のある組込みはすべて載せる。欠落すると VM 内で ReferenceError になるため、
  // 「現状使っていないが将来使う可能性があるもの」も防御的に含める（C14-01）。
  //
  // 追加基準（第15回 C15-11）:
  //  (1) 現行の storage / engine / helpers で実使用中のもの: 必須（Math / JSON / Array /
  //      Object / Number / String / Boolean / Set / Map / Error / SyntaxError / Date）
  //  (2) F1（slowThresholdSec 関連）/ F2（MESSAGES I18n）で使う見込み + エラー系:
  //      防御的に追加（Promise / RegExp / TypeError / RangeError / URIError /
  //      ReferenceError / Symbol / WeakMap / WeakSet / Intl / Reflect / Proxy /
  //      isFinite / isNaN / parseFloat / parseInt）
  //  (3) Web プラットフォーム固有の API（Blob / URL / URLSearchParams / TextEncoder /
  //      TextDecoder / AbortController / structuredClone / TypedArray 族 / ArrayBuffer /
  //      DataView）は**意図的に除外**。本プロジェクトのロジック層は localStorage / JSON /
  //      Math.random / Date のみに依存する pure-JS 設計で、Web API が VM に現れた瞬間
  //      「レイヤ分離の逸脱」と判別できる方がレビュー時の検出性が高い。将来必要になった
  //      時点で個別に追加判断する
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
    WeakMap,
    WeakSet,
    Symbol,
    Promise,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    URIError,
    ReferenceError,
    Date,
    Intl,
    Reflect,
    Proxy,
    isFinite,
    isNaN,
    parseFloat,
    parseInt,
  };
  vm.createContext(sandbox);

  const code = [
    STORAGE_SECTION,
    ENGINE_SECTION,
    HELPERS_SECTION,
    // 末尾で公開したいシンボルを return 代わりに完成式にする
    // 第16回 C16-09: COLD_START_COUNT / STATS_RESPONSE_TIME_SAMPLES も export し、tests 側が
    // マジックナンバー 3 / 5 をハードコードせず、定数変更時の silent drift を防ぐ。
    // 第19回 C19-22: SUPPORTED_LANGS も export。テスト側が ["auto","ja","en","zh-CN","zh-TW","ko","vi"]
    // をリテラル二重管理しないよう、Phase D での値域拡張時の drift を防ぐ。
    ";({ Storage, Engine, Util, I18n, ResultHelpers, StatsHelpers, DEFAULT_SETTINGS, WRONG_WEIGHT_BOOST_PRESETS, SLOW_THRESHOLD_PRESETS, SUPPORTED_LANGS, SESSION_LIMIT, STATS_RECENT_N, COLD_START_COUNT, STATS_RESPONSE_TIME_SAMPLES });",
  ].join("\n");

  const exported = vm.runInContext(code, sandbox, { filename: "core-extracted.js" });
  // Util.detectLang() は呼出時に typeof navigator をチェックするため、テスト側で navigator を
  // 動的に差替え可能にする (Phase C / SPEC §8.9.3 の zh-HK/zh-MO/zh-SG fallback テスト用)。
  // sandbox の global を後から書き換えても detectLang() は最新値を参照する。
  //
  // 第19回 C19-28: setNavigator は単純代入。テスト間で値をリセットしたい場合は
  // **必ず loadCore() を呼び直して fresh sandbox を取得する**こと。同じ Util を使い回して
  // setNavigator を 2 回連続で呼ぶと前回の値が "残る" 形になる (前者を上書きするだけ)。
  // tests/util-detectLang.test.mjs の withNavigator ヘルパーは内部で常に新規 loadCore() する
  // パターンで本問題を回避している (L16-20)。
  // 第19回 C19-05: navigator=null も明示的に渡せる (typeof null === "object" 経路の防御テスト用)。
  return {
    ...exported,
    localStorage: fakeLS,
    random,
    setNavigator(nav) { sandbox.navigator = nav; },
  };
}
