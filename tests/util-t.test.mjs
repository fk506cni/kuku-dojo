// Util.t ユニットテスト (v1.2.0 Phase A / SPEC §8.9.5 / prompts.md Step 12.A-2)。
//
// 仕様:
// - I18n.current の辞書 → ja 辞書 → key 文字列そのまま、の順でフォールバック
// - params は `{name}` プレースホルダ置換。複数パラメータ / 未指定時の残存 / 数値の文字列化をカバー
// - I18n.messages は load-core の VM sandbox 起動時に `{ ja: {} }` で初期化される (typeof document
//   ガード fallback)。テストごとに loadCore() で fresh sandbox を得て I18n.messages を書き換える。

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

test("Util.t: ja 辞書から直接文字列を取得する", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "greet.hello": "こんにちは" };
  I18n.current = "ja";
  assert.equal(Util.t("greet.hello"), "こんにちは");
});

test("Util.t: 存在しない key は key 文字列そのものを返す (最終フォールバック)", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = {};
  I18n.current = "ja";
  assert.equal(Util.t("no.such.key"), "no.such.key");
});

test("Util.t: I18n.current が null / 未設定なら ja にフォールバックする", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "init.loading": "よみこみちゅう" };
  I18n.current = null;
  assert.equal(Util.t("init.loading"), "よみこみちゅう");
});

test("Util.t: current 辞書に key が無い場合 ja フォールバックする (Phase B 未翻訳想定)", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "only.in.ja": "日本語版のみ" };
  I18n.messages.en = {}; // 英語版にまだ翻訳がないケース
  I18n.current = "en";
  assert.equal(Util.t("only.in.ja"), "日本語版のみ");
});

test("Util.t: current 辞書に key があれば current を優先する", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "greet": "こんにちは" };
  I18n.messages.en = { "greet": "Hello" };
  I18n.current = "en";
  assert.equal(Util.t("greet"), "Hello");
});

test("Util.t: params プレースホルダを埋込む", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "greet.name": "こんにちは {name} さん" };
  I18n.current = "ja";
  assert.equal(Util.t("greet.name", { name: "たろう" }), "こんにちは たろう さん");
});

test("Util.t: 複数 params を順序に依らず埋込む", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "score": "{correct} / {total} もんせいかい" };
  I18n.current = "ja";
  assert.equal(Util.t("score", { correct: 8, total: 10 }), "8 / 10 もんせいかい");
});

test("Util.t: 同じ placeholder が複数回ある場合すべて置換される", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "echo": "{word} {word} {word}" };
  I18n.current = "ja";
  assert.equal(Util.t("echo", { word: "やった" }), "やった やった やった");
});

test("Util.t: params 未指定時は placeholder をそのまま残す", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "template": "Hello {name}" };
  I18n.current = "ja";
  assert.equal(Util.t("template"), "Hello {name}");
});

test("Util.t: 数値 param は String() で文字列化される (SPEC §8.9.4 / C13-11 前提)", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "count": "{n} かい" };
  I18n.current = "ja";
  assert.equal(Util.t("count", { n: 5 }), "5 かい");
  assert.equal(Util.t("count", { n: 0 }), "0 かい");
});

test("Util.t: 呼出側が toFixed 済の文字列を渡すケース (小数点制御は呼出側責務)", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = { "avg": "だいたい {sec} びょう" };
  I18n.current = "ja";
  assert.equal(Util.t("avg", { sec: (3.456).toFixed(1) }), "だいたい 3.5 びょう");
});

test("Util.t: 存在しない key に params を渡しても key 文字列がそのまま返る (置換対象なし)", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = {};
  I18n.current = "ja";
  assert.equal(Util.t("nonexistent", { name: "X" }), "nonexistent");
});

// 第17回 C17-12: PRESETS value を MESSAGES key に埋込むパターン (`settings.XXX.<value>.label`)。
// String(value) の JS 挙動に依拠するため、float の扱いをロック:
//   - `String(1.0)` === `"1"` / `String(2.0)` === `"2"` (末尾 .0 drop)
//   - `String(0.5)` === `"0.5"` (dot 連結で 4 レベル key)
// 現行 index.html の `Util.t("settings.wrongWeightBoost." + value + ".label")` が
// 正しく `settings.wrongWeightBoost.0.5.label` / `.1.label` / `.2.label` を引ける契約を担保。
test("Util.t: PRESETS float value を dot 連結した key が正しく解決される (C17-12)", () => {
  const { Util, I18n } = loadCore();
  I18n.messages.ja = {
    "settings.wrongWeightBoost.0.5.label": "ひかえめ",
    "settings.wrongWeightBoost.1.label": "ふつう",
    "settings.wrongWeightBoost.2.label": "しっかり",
  };
  I18n.current = "ja";
  // float 0.5 は "0.5" (4 レベル key)
  assert.equal(Util.t("settings.wrongWeightBoost." + 0.5 + ".label"), "ひかえめ");
  // float 1.0 は "1" (3 レベル key / 末尾 .0 drop)
  assert.equal(Util.t("settings.wrongWeightBoost." + 1.0 + ".label"), "ふつう");
  // float 2.0 は "2" (3 レベル key / 末尾 .0 drop)
  assert.equal(Util.t("settings.wrongWeightBoost." + 2.0 + ".label"), "しっかり");
});
