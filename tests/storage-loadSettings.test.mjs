// Storage.loadSettings 回帰テスト。SPEC §2.2 / §2.3 / C11-04 / C11-06。
// v1.0.x 現行挙動の担保。F1 で slowThresholdSec マイグレーションが追加された時点で、
// このファイルに「欠損 → 10 補完」「プリセット外 → 10 正規化」のケースを追記する想定。

import { test } from "node:test";
import assert from "node:assert";
// 注: strict を使わないのは loadCore の返却値が Node の vm context 内 Object.prototype を
// 持つため、host 側 {...} リテラルとの deepStrictEqual が prototype 不一致で落ちるため。
// 構造の一致だけを検査したいので非 strict の deepEqual を使う。
import { loadCore } from "./helpers/load-core.mjs";

function withSettings(accountId, settings) {
  return loadCore({
    initialStorage: {
      ["kuku_settings_" + accountId]: JSON.stringify(settings),
    },
  });
}

test("loadSettings: キー未存在なら DEFAULT_SETTINGS を返す", () => {
  const { Storage, DEFAULT_SETTINGS } = loadCore();
  const s = Storage.loadSettings("acct-new");
  assert.deepEqual(s, { ...DEFAULT_SETTINGS });
});

test("loadSettings: 旧 Settings（wrongWeightBoost 欠損）は既定 1.0 で補完（前方互換）", () => {
  const { Storage } = withSettings("acct-v0", {
    soundEnabled: false,
    effectsEnabled: true,
    volume: 0.8,
    // wrongWeightBoost 欠損 — v0.x 時代の Settings 想定
  });
  const s = Storage.loadSettings("acct-v0");
  assert.equal(s.soundEnabled, false);
  assert.equal(s.effectsEnabled, true);
  assert.equal(s.volume, 0.8);
  assert.equal(s.wrongWeightBoost, 1.0);
});

test("loadSettings: wrongWeightBoost プリセット外値は 1.0 に正規化（C11-06）", () => {
  const { Storage } = withSettings("acct-odd", {
    soundEnabled: true,
    effectsEnabled: true,
    volume: 0.4,
    wrongWeightBoost: 1.5, // 手編集異常値
  });
  assert.equal(Storage.loadSettings("acct-odd").wrongWeightBoost, 1.0);
});

test("loadSettings: プリセット値 0.5 / 1.0 / 2.0 はそのまま保持", () => {
  for (const v of [0.5, 1.0, 2.0]) {
    const { Storage } = withSettings("acct-v-" + v, {
      soundEnabled: true,
      effectsEnabled: true,
      volume: 0.4,
      wrongWeightBoost: v,
    });
    assert.equal(Storage.loadSettings("acct-v-" + v).wrongWeightBoost, v);
  }
});

test("loadSettings: 配列が入っていても DEFAULT_SETTINGS にフォールバック（C11-04）", () => {
  // typeof [] === "object" を通過する配列を Array.isArray ガードで弾く
  const { Storage, DEFAULT_SETTINGS } = withSettings("acct-arr", [1, 2, 3]);
  assert.deepEqual(Storage.loadSettings("acct-arr"), { ...DEFAULT_SETTINGS });
});

test("loadSettings: null / 非オブジェクトは DEFAULT_SETTINGS にフォールバック", () => {
  const { Storage, DEFAULT_SETTINGS } = withSettings("acct-null", null);
  assert.deepEqual(Storage.loadSettings("acct-null"), { ...DEFAULT_SETTINGS });
});

test("loadSettings: 破損 JSON はキーを破棄して DEFAULT_SETTINGS を返す（SPEC §2.4）", () => {
  const { Storage, DEFAULT_SETTINGS, localStorage } = loadCore({
    initialStorage: { "kuku_settings_acct-broken": "{not json" },
  });
  assert.deepEqual(Storage.loadSettings("acct-broken"), { ...DEFAULT_SETTINGS });
  // 破棄されていること
  assert.equal(localStorage.getItem("kuku_settings_acct-broken"), null);
});
