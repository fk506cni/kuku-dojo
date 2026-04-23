// Storage.loadSettings 回帰テスト。SPEC §2.2 / §2.3 / C11-04 / C11-06 / §8.8.2。
// v1.0.x 現行挙動の担保 + F1 (v1.1.0) で追加された slowThresholdSec マイグレーションの検証。

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

// 第16回 C16-05: JSON.stringify は NaN / Infinity を null に変換するため、withSettings 経由では
// プリセット外異常値（負数 / Infinity / 非数値 / 真偽値 / 小数）を忠実にテストできない。
// withSettingsRaw は localStorage に生の JSON 文字列を書き込み、loadSettings の正規化パスを直接検証する。
function withSettingsRaw(accountId, rawJson) {
  return loadCore({
    initialStorage: {
      ["kuku_settings_" + accountId]: rawJson,
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

// ── F1 (v1.1.0) slowThresholdSec マイグレーション ─────────────────
// SPEC §8.8.2: v1.0.x から上がった既存ユーザーの Settings に slowThresholdSec が無ければ 10 で補完。
// プリセット {15, 10, 7, 5} 外の値は 10 (ふつう) に正規化 (C11-06 と同パターン / C12-21 解消)。

test("loadSettings: 旧 v1.0.x Settings（slowThresholdSec 欠損）は 10 で補完（F1 マイグレ）", () => {
  const { Storage } = withSettings("acct-v10x", {
    soundEnabled: true,
    effectsEnabled: true,
    volume: 0.4,
    wrongWeightBoost: 1.0,
    // slowThresholdSec 欠損 — v1.0.x Settings 想定
  });
  assert.equal(Storage.loadSettings("acct-v10x").slowThresholdSec, 10);
});

test("loadSettings: slowThresholdSec プリセット外（3 / 99 / 文字列）は 10 に正規化", () => {
  for (const v of [3, 99, "10", null, NaN]) {
    const { Storage } = withSettings("acct-s-" + String(v), {
      soundEnabled: true,
      effectsEnabled: true,
      volume: 0.4,
      wrongWeightBoost: 1.0,
      slowThresholdSec: v,
    });
    assert.equal(Storage.loadSettings("acct-s-" + String(v)).slowThresholdSec, 10,
      "プリセット外値 " + String(v) + " は 10 に正規化されるべき");
  }
});

test("loadSettings: slowThresholdSec プリセット値 15 / 10 / 7 / 5 はそのまま保持", () => {
  for (const v of [15, 10, 7, 5]) {
    const { Storage } = withSettings("acct-sok-" + v, {
      soundEnabled: true,
      effectsEnabled: true,
      volume: 0.4,
      wrongWeightBoost: 1.0,
      slowThresholdSec: v,
    });
    assert.equal(Storage.loadSettings("acct-sok-" + v).slowThresholdSec, v);
  }
});

test("loadSettings: v1.0.0 → 最新への直接マイグレーション（wrongWeightBoost + slowThresholdSec + lang 同時補完 / C12-21 / §8.9.9）", () => {
  // v1.0.0 時点では wrongWeightBoost / slowThresholdSec / lang いずれも無い可能性がある。
  // Phase A (v1.2.0) で lang も追加し、直接マイグレが 3 フィールド同時に効くことを担保する。
  const { Storage } = withSettings("acct-v100", {
    soundEnabled: true,
    effectsEnabled: false,
    volume: 0.2,
    // wrongWeightBoost / slowThresholdSec / lang 欠損
  });
  const s = Storage.loadSettings("acct-v100");
  assert.equal(s.wrongWeightBoost, 1.0);
  assert.equal(s.slowThresholdSec, 10);
  assert.equal(s.lang, "auto");
  // 既存フィールドは保持
  assert.equal(s.soundEnabled, true);
  assert.equal(s.effectsEnabled, false);
  assert.equal(s.volume, 0.2);
});

// ── F2 Phase A (v1.2.0) lang マイグレーション ─────────────────
// SPEC §8.9.9 / C12-21: lang 欠損は "auto" で補完、SUPPORTED_LANGS 外の値も "auto" に正規化。

test("loadSettings: 旧 Settings（lang 欠損）は \"auto\" で補完（F2 Phase A マイグレ / §8.9.9）", () => {
  const { Storage } = withSettings("acct-no-lang", {
    soundEnabled: true,
    effectsEnabled: true,
    volume: 0.4,
    wrongWeightBoost: 1.0,
    slowThresholdSec: 10,
    // lang 欠損 — v1.0.x / v1.1.0 Settings 想定
  });
  assert.equal(Storage.loadSettings("acct-no-lang").lang, "auto");
});

test("loadSettings: lang サポート済み値 (SUPPORTED_LANGS 内) はそのまま保持", () => {
  const supported = ["auto", "ja", "en", "zh-CN", "zh-TW", "ko", "vi", "es", "pt-BR"];
  for (const v of supported) {
    const { Storage } = withSettings("acct-l-" + v, {
      soundEnabled: true,
      effectsEnabled: true,
      volume: 0.4,
      wrongWeightBoost: 1.0,
      slowThresholdSec: 10,
      lang: v,
    });
    assert.equal(Storage.loadSettings("acct-l-" + v).lang, v);
  }
});

test("loadSettings: lang SUPPORTED_LANGS 外（未知言語 / 大文字 / 型不正）は \"auto\" に正規化", () => {
  // 未知言語コード / 大文字ゆれ / 空文字 / null / 配列 / オブジェクトなど手編集や JSON 異常を網羅。
  const cases = ["fr", "JA", "en-US", "zh", "", "xx", 123, true, null, undefined, ["ja"], { code: "ja" }];
  for (const v of cases) {
    const { Storage } = withSettings("acct-badl-" + String(v), {
      soundEnabled: true,
      effectsEnabled: true,
      volume: 0.4,
      wrongWeightBoost: 1.0,
      slowThresholdSec: 10,
      lang: v,
    });
    assert.equal(
      Storage.loadSettings("acct-badl-" + String(v)).lang,
      "auto",
      "不正な lang " + String(v) + " は \"auto\" に正規化されるべき",
    );
  }
});

// 第16回 C16-05 / C16-20: JSON.stringify で失われる異常値 (Infinity / NaN / 負数 / 小数 / 真偽値) を
// 生 JSON 文字列で直接注入し、Storage.loadSettings のプリセット外正規化が堅牢であることを確認する。
// withSettings 経由ではこれらの値の多くが null に decode されてしまい、忠実なカバレッジにならない。
test("loadSettings: slowThresholdSec が負数 / Infinity / 真偽値 / 小数 / 大きすぎる整数の raw JSON でも 10 に正規化（C16-05 / C16-20）", () => {
  const base = '"soundEnabled":true,"effectsEnabled":true,"volume":0.4,"wrongWeightBoost":1.0';
  const cases = [
    ['{' + base + ',"slowThresholdSec":-5}',      "負数"],
    ['{' + base + ',"slowThresholdSec":1e308}',   "大きすぎる整数"],
    ['{' + base + ',"slowThresholdSec":10.5}',    "非プリセット小数"],
    ['{' + base + ',"slowThresholdSec":true}',    "真偽値 true"],
    ['{' + base + ',"slowThresholdSec":false}',   "真偽値 false"],
    ['{' + base + ',"slowThresholdSec":[10]}',    "配列"],
    ['{' + base + ',"slowThresholdSec":{"v":10}}', "オブジェクト"],
  ];
  for (const [raw, desc] of cases) {
    const { Storage } = withSettingsRaw("acct-raw-" + desc, raw);
    assert.equal(
      Storage.loadSettings("acct-raw-" + desc).slowThresholdSec,
      10,
      desc + " (" + raw + ") は 10 に正規化されるべき",
    );
  }
});

test("loadSettings: wrongWeightBoost が負数 / 小数 / 真偽値の raw JSON でも 1.0 に正規化（C16-20）", () => {
  const base = '"soundEnabled":true,"effectsEnabled":true,"volume":0.4,"slowThresholdSec":10';
  const cases = [
    ['{' + base + ',"wrongWeightBoost":-1}',      "負数"],
    ['{' + base + ',"wrongWeightBoost":1.5}',     "非プリセット小数"],
    ['{' + base + ',"wrongWeightBoost":true}',    "真偽値"],
  ];
  for (const [raw, desc] of cases) {
    const { Storage } = withSettingsRaw("acct-wb-raw-" + desc, raw);
    assert.equal(
      Storage.loadSettings("acct-wb-raw-" + desc).wrongWeightBoost,
      1.0,
      desc + " (" + raw + ") は 1.0 に正規化されるべき",
    );
  }
});
