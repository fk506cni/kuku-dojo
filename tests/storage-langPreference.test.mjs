// Storage.loadLangPreference / saveLangPreference のユニットテスト。
//
// 背景: 第18回敵対的レビュー後、ユーザー判断で「ja 環境ブラウザ + en 設定 Account」シナリオの
// Login 画面 ja 表示退行を device-level preference で解消する案 (案 A) を採用 (CHANGELOG /
// SPEC.md §8.9.X / index.html Storage 参照)。
//
// 仕様:
// - localStorage キー `kuku_lang_preference` は SUPPORTED_LANGS のいずれか (Phase C 時点
//   ["auto","ja","en","zh-CN","zh-TW","ko","vi"]) を保存する。
// - 未保存 / 範囲外値 / Storage 不可 → DEFAULT_SETTINGS.lang ("auto") にフォールバック。
// - saveLangPreference は SUPPORTED_LANGS 外を silent に no-op (二重通知回避)。

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

test("loadLangPreference: 未保存なら DEFAULT_SETTINGS.lang ('auto') を返す", () => {
  const { Storage, DEFAULT_SETTINGS } = loadCore();
  assert.equal(Storage.loadLangPreference(), DEFAULT_SETTINGS.lang);
  assert.equal(Storage.loadLangPreference(), "auto");
});

test("loadLangPreference: 保存済み SUPPORTED_LANGS 値はそのまま返す", () => {
  for (const v of ["auto", "ja", "en", "zh-CN", "zh-TW", "ko", "vi"]) {
    const { Storage } = loadCore({
      initialStorage: { "kuku_lang_preference": v },
    });
    assert.equal(Storage.loadLangPreference(), v);
  }
});

test("loadLangPreference: SUPPORTED_LANGS 外の値 (旧バージョン / 手編集) は 'auto' に正規化", () => {
  // Phase C (v1.3.0) 時点 — Phase D で追加予定の es/pt-BR は依然 範囲外
  const cases = ["es", "pt-BR", "fr", "JA", "en-US", "zh-HK", "", "xx", "123"];
  for (const v of cases) {
    const { Storage } = loadCore({
      initialStorage: { "kuku_lang_preference": v },
    });
    assert.equal(
      Storage.loadLangPreference(), "auto",
      `value ${JSON.stringify(v)} should normalize to "auto"`
    );
  }
});

test("saveLangPreference: SUPPORTED_LANGS 値は localStorage に保存され、loadLangPreference で読み戻せる", () => {
  for (const v of ["auto", "ja", "en", "zh-CN", "zh-TW", "ko", "vi"]) {
    const { Storage } = loadCore();
    const ok = Storage.saveLangPreference(v);
    assert.equal(ok, true);
    assert.equal(Storage.loadLangPreference(), v);
  }
});

test("saveLangPreference: SUPPORTED_LANGS 外は no-op で false を返し、保存しない (sticky check)", () => {
  const cases = ["es", "pt-BR", "fr", "JA", "en-US", "zh-HK", "", "xx", null, undefined, 123, true, ["ja"], { code: "ja" }];
  for (const v of cases) {
    const { Storage } = loadCore({
      initialStorage: { "kuku_lang_preference": "en" }, // 既存値を上書きさせない
    });
    const ok = Storage.saveLangPreference(v);
    assert.equal(ok, false, `value ${JSON.stringify(v)} should be rejected`);
    // 既存値 "en" が温存されていることを確認
    assert.equal(Storage.loadLangPreference(), "en");
  }
});

test("saveLangPreference → loadLangPreference: 上書き挙動 (en → ja → auto の遷移)", () => {
  const { Storage } = loadCore();
  Storage.saveLangPreference("en");
  assert.equal(Storage.loadLangPreference(), "en");
  Storage.saveLangPreference("ja");
  assert.equal(Storage.loadLangPreference(), "ja");
  Storage.saveLangPreference("auto");
  assert.equal(Storage.loadLangPreference(), "auto");
});

test("loadLangPreference: Storage._available=false (private mode 等) でも例外を投げず 'auto' を返す", () => {
  const { Storage } = loadCore();
  Storage._available = false;
  assert.equal(Storage.loadLangPreference(), "auto");
});

test("saveLangPreference: Storage._available=false (private mode 等) でも例外を投げず false を返す", () => {
  const { Storage } = loadCore();
  Storage._available = false;
  assert.equal(Storage.saveLangPreference("en"), false);
});
