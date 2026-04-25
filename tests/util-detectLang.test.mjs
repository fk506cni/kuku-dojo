// Util.detectLang ユニットテスト (v1.3.0 Phase C / SPEC §8.9.3 / prompts.md Step 12.C-3)。
//
// 仕様:
// - SUPPORTED = ["ja", "en", "zh-CN", "zh-TW", "ko", "vi"] (Phase C 時点)
// - FALLBACKS で region variant を親言語に振る:
//     zh-HK → zh-TW / zh-MO → zh-TW / zh-SG → zh-CN
//     (pt-PT → pt-BR は Phase D で復活)
// - navigator.languages[] を先に走査、無ければ [navigator.language || "ja"]
// - 完全一致 → base 部分一致 の順で採用、最終的に "ja" フォールバック
// - C12-19: navigator.languages の undefined / 空文字列 / 非 string 混入をガード

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

function withNavigator(languages) {
  const core = loadCore();
  core.setNavigator({ languages });
  return core.Util;
}

test("detectLang: navigator 未設定なら 'ja' フォールバック", () => {
  const { Util } = loadCore();
  assert.equal(Util.detectLang(), "ja");
});

test("detectLang: SUPPORTED 6 言語の完全一致をそれぞれ拾う", () => {
  for (const lang of ["ja", "en", "zh-CN", "zh-TW", "ko", "vi"]) {
    const Util = withNavigator([lang]);
    assert.equal(Util.detectLang(), lang, `${lang} should match exactly`);
  }
});

test("detectLang: base 部分一致 — en-US → 'en' / ja-JP → 'ja' / ko-KR → 'ko' / vi-VN → 'vi'", () => {
  assert.equal(withNavigator(["en-US"]).detectLang(), "en");
  assert.equal(withNavigator(["ja-JP"]).detectLang(), "ja");
  assert.equal(withNavigator(["ko-KR"]).detectLang(), "ko");
  assert.equal(withNavigator(["vi-VN"]).detectLang(), "vi");
});

// ---- FALLBACKS マップ (SPEC §8.9.3 / 第12回 C12-17 / Step 12.C-3) ----

test("detectLang: FALLBACKS — zh-HK は zh-TW (繁体) に振られる", () => {
  assert.equal(withNavigator(["zh-HK"]).detectLang(), "zh-TW");
});

test("detectLang: FALLBACKS — zh-MO は zh-TW (繁体) に振られる", () => {
  assert.equal(withNavigator(["zh-MO"]).detectLang(), "zh-TW");
});

test("detectLang: FALLBACKS — zh-SG は zh-CN (簡体) に振られる", () => {
  assert.equal(withNavigator(["zh-SG"]).detectLang(), "zh-CN");
});

test("detectLang: zh 単独は SUPPORTED に無いため 'ja' フォールバック (zh-Hans / zh-Hant も同様)", () => {
  // 中国語は地域別 (zh-CN / zh-TW) を SUPPORTED にしているので、bare "zh" は base 一致しない。
  // base "zh" は SUPPORTED に存在せず、最終 ja フォールバックする。
  assert.equal(withNavigator(["zh"]).detectLang(), "ja");
  assert.equal(withNavigator(["zh-Hans"]).detectLang(), "ja");
  assert.equal(withNavigator(["zh-Hant"]).detectLang(), "ja");
});

test("detectLang: 未サポート言語 (fr / es / pt-BR) は 'ja' フォールバック (Phase D 未実装)", () => {
  assert.equal(withNavigator(["fr"]).detectLang(), "ja");
  assert.equal(withNavigator(["es"]).detectLang(), "ja");
  assert.equal(withNavigator(["pt-BR"]).detectLang(), "ja");
});

test("detectLang: navigator.languages 配列の優先順位 — 先頭の SUPPORTED 値を採用", () => {
  // ["fr", "en", "ja"] は fr 不一致 → en 完全一致で確定
  assert.equal(withNavigator(["fr", "en", "ja"]).detectLang(), "en");
  // ["xx", "ko-KR", "ja"] は xx 不一致 → ko-KR base 一致で "ko" 確定
  assert.equal(withNavigator(["xx", "ko-KR", "ja"]).detectLang(), "ko");
});

test("detectLang: 配列内に zh-HK と zh-CN が混在 → 先勝ちで zh-TW / zh-CN を判定", () => {
  // 香港ユーザーが zh-HK を最優先にした場合
  assert.equal(withNavigator(["zh-HK", "zh-CN"]).detectLang(), "zh-TW");
  // シンガポールユーザーが zh-SG を最優先にした場合
  assert.equal(withNavigator(["zh-SG", "zh-TW"]).detectLang(), "zh-CN");
});

test("detectLang: navigator.language (単数) のみのブラウザ — 配列が無くても採用される", () => {
  const core = loadCore();
  core.setNavigator({ language: "vi" });
  assert.equal(core.Util.detectLang(), "vi");
});

test("detectLang: navigator.language も無いケース → 'ja' フォールバック", () => {
  const core = loadCore();
  core.setNavigator({});
  assert.equal(core.Util.detectLang(), "ja");
});

test("detectLang: navigator.languages が空配列 → navigator.language にフォールバック", () => {
  const core = loadCore();
  core.setNavigator({ languages: [], language: "zh-TW" });
  assert.equal(core.Util.detectLang(), "zh-TW");
});

// ---- C12-19: 防御的ガード ----

test("detectLang: navigator.languages 内の非 string / 空文字列はスキップされる (C12-19)", () => {
  // undefined / null / 数値 / 空文字列をスキップして次要素を評価する
  assert.equal(withNavigator([undefined, "", null, 123, "ja"]).detectLang(), "ja");
  assert.equal(withNavigator(["", "zh-HK"]).detectLang(), "zh-TW");
});

test("detectLang: navigator.language が undefined でも例外を投げず 'ja' を返す", () => {
  const core = loadCore();
  core.setNavigator({ language: undefined });
  assert.equal(core.Util.detectLang(), "ja");
});
