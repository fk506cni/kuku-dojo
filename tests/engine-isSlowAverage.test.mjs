// Engine.isSlowAverage ユニットテスト。SPEC §8.8 / prompts.md Step 11 実装対象 3。
// F1 (v1.1.0) で追加される判定関数。**Engine.proficiencyLevel / updateWeight には触らない**ことを
// 既存 tests/engine-{updateWeight,proficiencyLevel}.test.mjs の all-pass で担保する。
//
// 仕様:
// - avgResponseMs が number でない / <= 0 → false（データ無し）
// - avgResponseMs > thresholdSec * 1000 → true
// - ちょうど thresholdSec * 1000 → false（> なので境界ジャスト含まず）

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

const { Engine } = loadCore();

test("isSlowAverage: avgResponseMs が number でないと false", () => {
  assert.equal(Engine.isSlowAverage(undefined, 10), false);
  assert.equal(Engine.isSlowAverage(null, 10), false);
  assert.equal(Engine.isSlowAverage("1500", 10), false);
  assert.equal(Engine.isSlowAverage(NaN, 10), false);
});

test("isSlowAverage: avgResponseMs <= 0 は false（データ無し扱い）", () => {
  assert.equal(Engine.isSlowAverage(0, 10), false);
  assert.equal(Engine.isSlowAverage(-1, 10), false);
});

test("isSlowAverage: avgResponseMs > thresholdSec*1000 で true", () => {
  assert.equal(Engine.isSlowAverage(10001, 10), true);
  assert.equal(Engine.isSlowAverage(15000.1, 15), true);
  assert.equal(Engine.isSlowAverage(5001, 5), true);
});

test("isSlowAverage: ちょうど境界 thresholdSec*1000 は false（> のみ true）", () => {
  assert.equal(Engine.isSlowAverage(10000, 10), false);
  assert.equal(Engine.isSlowAverage(7000, 7), false);
  assert.equal(Engine.isSlowAverage(5000, 5), false);
});

test("isSlowAverage: しきい値未満は false（十分はやい）", () => {
  assert.equal(Engine.isSlowAverage(2500, 10), false);
  assert.equal(Engine.isSlowAverage(4999, 5), false);
});

// 第16回 C16-06: thresholdSec 側の防御ガードも回帰担保する。実装上は
// `typeof thresholdSec !== "number" || !Number.isFinite(thresholdSec) || thresholdSec <= 0` で
// false に落とす設計だが、リファクタで消えても silent に通らないよう明示的にカバーする。
test("isSlowAverage: thresholdSec が number でない / <=0 / Infinity / NaN は false（C16-06）", () => {
  assert.equal(Engine.isSlowAverage(10001, undefined), false);
  assert.equal(Engine.isSlowAverage(10001, null), false);
  assert.equal(Engine.isSlowAverage(10001, "10"), false);
  assert.equal(Engine.isSlowAverage(10001, NaN), false);
  assert.equal(Engine.isSlowAverage(10001, Infinity), false);
  assert.equal(Engine.isSlowAverage(10001, -Infinity), false);
  assert.equal(Engine.isSlowAverage(10001, 0), false);
  assert.equal(Engine.isSlowAverage(10001, -5), false);
});
