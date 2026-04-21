// Engine.updateWeight 回帰テスト。SPEC §3.2。第13回 C13-20 (c)。
// F1 で触らない箇所の不変担保（重み更新式・clamp・wrongWeightBoost 倍率）。

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

const { Engine } = loadCore();

test("updateWeight: 正解で -0.3、未登録キーは 1.0 起点", () => {
  const next = Engine.updateWeight({}, 3, 4, true);
  assert.equal(next["3-4"], 0.7);
});

test("updateWeight: 不正解で +2.0（既定 wrongWeightBoost=1.0）", () => {
  const next = Engine.updateWeight({ "3-4": 1.0 }, 3, 4, false);
  assert.equal(next["3-4"], 3.0);
});

test("updateWeight: 下限 0.5 クランプ（正解を繰り返しても下限を割らない）", () => {
  let w = { "2-2": 0.6 };
  w = Engine.updateWeight(w, 2, 2, true); // 0.3 → clamp 0.5
  assert.equal(w["2-2"], 0.5);
  w = Engine.updateWeight(w, 2, 2, true); // 0.2 → clamp 0.5
  assert.equal(w["2-2"], 0.5);
});

test("updateWeight: 上限 10.0 クランプ（連続不正解でも超えない）", () => {
  let w = { "9-9": 9.5 };
  w = Engine.updateWeight(w, 9, 9, false); // 11.5 → clamp 10.0
  assert.equal(w["9-9"], 10.0);
  w = Engine.updateWeight(w, 9, 9, false); // 12.0 → clamp 10.0
  assert.equal(w["9-9"], 10.0);
});

test("updateWeight: wrongWeightBoost=0.5 は +1.0 加算", () => {
  const next = Engine.updateWeight({ "5-5": 1.0 }, 5, 5, false, 0.5);
  assert.equal(next["5-5"], 2.0);
});

test("updateWeight: wrongWeightBoost=2.0 は +4.0 加算、正解側は -0.3 固定", () => {
  const inc = Engine.updateWeight({ "5-5": 1.0 }, 5, 5, false, 2.0);
  assert.equal(inc["5-5"], 5.0);
  const dec = Engine.updateWeight({ "5-5": 1.0 }, 5, 5, true, 2.0);
  assert.equal(dec["5-5"], 0.7); // 正解減算は boost 非対象
});

test("updateWeight: wrongWeightBoost が非数値 / 0 以下なら 1.0 フォールバック", () => {
  const a = Engine.updateWeight({ "1-1": 1.0 }, 1, 1, false, undefined);
  assert.equal(a["1-1"], 3.0);
  const b = Engine.updateWeight({ "1-1": 1.0 }, 1, 1, false, 0);
  assert.equal(b["1-1"], 3.0);
  const c = Engine.updateWeight({ "1-1": 1.0 }, 1, 1, false, -1);
  assert.equal(c["1-1"], 3.0);
  const d = Engine.updateWeight({ "1-1": 1.0 }, 1, 1, false, NaN);
  assert.equal(d["1-1"], 3.0);
});

test("updateWeight: 元オブジェクトを破壊しない（新オブジェクトを返す）", () => {
  const before = { "7-8": 1.0 };
  const after = Engine.updateWeight(before, 7, 8, false);
  assert.equal(before["7-8"], 1.0);
  assert.notEqual(before, after);
  assert.equal(after["7-8"], 3.0);
});
