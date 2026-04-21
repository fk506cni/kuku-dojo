// Engine.proficiencyLevel 回帰テスト。SPEC §3.3。第13回 C13-20 (c)。
// F1 で触らない箇所の不変担保（L0〜L4 判定と包括ルール L3）。

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

const { Engine } = loadCore();

test("proficiencyLevel: attempts=0 は L0 未挑戦（他条件を無視）", () => {
  assert.equal(Engine.proficiencyLevel(10.0, 0.0, 0), 0);
  assert.equal(Engine.proficiencyLevel(0.5, 1.0, 0), 0);
});

test("proficiencyLevel: L1 苦手（重み≥2.0 OR 正答率<40%）", () => {
  assert.equal(Engine.proficiencyLevel(2.0, 0.9, 10), 1);
  assert.equal(Engine.proficiencyLevel(1.0, 0.39, 10), 1);
  assert.equal(Engine.proficiencyLevel(10.0, 1.0, 5), 1);
});

test("proficiencyLevel: L2 要練習（重み≥1.2 OR 正答率<70%、L1 未該当）", () => {
  assert.equal(Engine.proficiencyLevel(1.2, 0.9, 10), 2);
  assert.equal(Engine.proficiencyLevel(1.0, 0.69, 10), 2);
  assert.equal(Engine.proficiencyLevel(1.9, 0.85, 10), 2); // 2.0 未満
});

test("proficiencyLevel: L4 得意（重み≤0.6 AND 正答率≥90%、慎重格上げ）", () => {
  assert.equal(Engine.proficiencyLevel(0.6, 0.9, 10), 4);
  assert.equal(Engine.proficiencyLevel(0.5, 1.0, 10), 4);
});

test("proficiencyLevel: L3 包括ルール（L1/L2/L4 のいずれにも該当しない中間）", () => {
  // 重み 0.5 ∧ 正答率 0.85 — L4 の AND 条件「正答率≥90%」を満たさず、L2 の OR も非該当
  assert.equal(Engine.proficiencyLevel(0.5, 0.85, 10), 3);
  // 重み 0.7 ∧ 正答率 0.95 — L4 の AND 条件「重み≤0.6」を満たさず、L2 の OR も非該当
  assert.equal(Engine.proficiencyLevel(0.7, 0.95, 10), 3);
  // 重み 1.0 ∧ 正答率 0.80 — L1/L2 共に非該当、L4 の AND 片方欠け
  assert.equal(Engine.proficiencyLevel(1.0, 0.80, 10), 3);
});

test("proficiencyLevel: 境界値で L1 優先（上位優先の評価順）", () => {
  // 重み=2.0 かつ 正答率=95% → L1 が優先（苦手早期救済）
  assert.equal(Engine.proficiencyLevel(2.0, 0.95, 10), 1);
});
