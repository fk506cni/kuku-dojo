// Engine.pickQuestion 決定論テスト。C11-24 / 第13回 C13-20 (b)。
// RNG を seed 注入で決定論化し、入力正規化と重み比例抽選の回帰担保を行う。

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

test("pickQuestion: LCG seed を注入すれば出題列が再現可能（テスト時の決定論担保 / 本番 Math.random の担保ではない）", () => {
  // C14-10: 本テストは makeSeededRandom の LCG が deterministic であることと、
  // pickQuestion がその乱数を忠実に消費することの 2 点を担保する。
  // 本番環境の Math.random を使った挙動は担保しない点に注意。
  const a = loadCore({ randomSeed: 42 });
  const b = loadCore({ randomSeed: 42 });
  const weights = a.Engine.initialWeights();
  const recent = [];
  const seqA = [];
  const seqB = [];
  for (let i = 0; i < 50; i++) {
    seqA.push(a.Engine.pickQuestion([1, 2, 3], weights, recent));
    seqB.push(b.Engine.pickQuestion([1, 2, 3], weights, recent));
  }
  assert.deepEqual(seqA, seqB);
});

test("pickQuestion: selectedDans が空配列なら全段 [1..9] にフォールバック", () => {
  const { Engine } = loadCore({ randomSeed: 1 });
  const weights = Engine.initialWeights();
  const dans = new Set();
  for (let i = 0; i < 400; i++) {
    const q = Engine.pickQuestion([], weights, []);
    dans.add(q.dan);
  }
  // seed 固定で 400 回引けば 1..9 がすべて現れる
  for (let d = 1; d <= 9; d++) assert.ok(dans.has(d), `段 ${d} が 400 試行で出題されない`);
});

test("pickQuestion: 値域外・重複・非整数を含む selectedDans でも正規化されて dan ∈ {2,5}", () => {
  const { Engine } = loadCore({ randomSeed: 7 });
  const weights = Engine.initialWeights();
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const q = Engine.pickQuestion([2, 2, 5, 0, 10, 3.7, "2", null, 5], weights, []);
    seen.add(q.dan);
    assert.ok(q.multiplier >= 1 && q.multiplier <= 9);
  }
  assert.deepEqual([...seen].sort(), [2, 5]);
});

test("pickQuestion: recent 2 問は除外される（候補が空にならない限り）", () => {
  const { Engine } = loadCore({ randomSeed: 123 });
  const weights = Engine.initialWeights();
  // recent に同一段の 8 問を詰めても「残り 1 問」は引き続き出題されうる、
  // 9 問すべて詰めると候補が空になりフォールバックされる。
  for (let tries = 0; tries < 200; tries++) {
    const recent = ["3-1", "3-2"];
    const q = Engine.pickQuestion([3], weights, recent);
    assert.ok(!recent.includes(q.dan + "-" + q.multiplier));
  }
});

test("pickQuestion: recent に全候補が入っていたらフォールバックして出題する（無限ループ防止）", () => {
  const { Engine } = loadCore({ randomSeed: 99 });
  const weights = Engine.initialWeights();
  const recent = [];
  for (let m = 1; m <= 9; m++) recent.push("3-" + m);
  const q = Engine.pickQuestion([3], weights, recent);
  assert.equal(q.dan, 3);
  assert.ok(q.multiplier >= 1 && q.multiplier <= 9);
});

test("pickQuestion: 累積重み配列の単調性（重み 0 のエントリは cumulative[i-1]==cumulative[i] になり抽選に出現しない）", () => {
  // C14-11: 本テストは SPEC §2.3 下限 0.5 の規約を担保するものではない。
  // 規約外の weight=0 が誤って localStorage に混入した場合でも、
  // 累積重み配列の構造的不変条件として「0 エントリは選ばれない」ことを検証する。
  // 通常 updateWeight 経由では 0 は作られない（clamp 下限 0.5）。
  const { Engine } = loadCore({ randomSeed: 5 });
  const weights = {};
  for (let dan = 1; dan <= 3; dan++) {
    for (let m = 1; m <= 9; m++) weights[dan + "-" + m] = dan === 2 ? 0 : 1.0;
  }
  for (let i = 0; i < 200; i++) {
    const q = Engine.pickQuestion([1, 2, 3], weights, []);
    assert.notEqual(q.dan, 2, "重み 0 の段が抽選された");
  }
});
