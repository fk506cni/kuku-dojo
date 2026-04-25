// Util.detectLang ユニットテスト (v1.3.0 Phase C / SPEC §8.9.3 / prompts.md Step 12.C-3)。
//
// 仕様:
// - SUPPORTED = ["ja", "en", "zh-CN", "zh-TW", "ko", "vi"] (Phase C 時点)
// - FALLBACKS で region variant + script tag 形式を親言語に振る:
//     region: zh-HK → zh-TW / zh-MO → zh-TW / zh-SG → zh-CN
//     script: zh-Hans / zh-Hans-CN / zh-Hans-SG → zh-CN
//             zh-Hant / zh-Hant-TW / zh-Hant-HK / zh-Hant-MO → zh-TW (第19回 C19-06)
//     (pt-PT → pt-BR は Phase D で復活)
// - navigator.languages[] を先に走査、無ければ [navigator.language || "ja"]
// - 完全一致 → base 部分一致 の順で採用、最終的に "ja" フォールバック
// - C12-19: navigator.languages の undefined / 空文字列 / 非 string 混入をガード
// - 第19回 C19-05: navigator === null (typeof null === "object" を素通る) も空 nav にフォールバック

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

test("detectLang: SUPPORTED 6 言語の完全一致をそれぞれ拾う (load-core export 経由)", () => {
  // 第19回 C19-22: SUPPORTED_LANGS を load-core から取得し、リテラル二重管理を避ける。
  const { SUPPORTED_LANGS } = loadCore();
  // "auto" を除いた実装言語のみ
  const implemented = SUPPORTED_LANGS.filter((v) => v !== "auto");
  assert.deepEqual(implemented, ["ja", "en", "zh-CN", "zh-TW", "ko", "vi"]);
  for (const lang of implemented) {
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

// ---- FALLBACKS マップ (SPEC §8.9.3 / 第12回 C12-17 / 第19回 C19-06) ----

test("detectLang: FALLBACKS — zh-HK は zh-TW (繁体) に振られる", () => {
  assert.equal(withNavigator(["zh-HK"]).detectLang(), "zh-TW");
});

test("detectLang: FALLBACKS — zh-MO は zh-TW (繁体) に振られる", () => {
  assert.equal(withNavigator(["zh-MO"]).detectLang(), "zh-TW");
});

test("detectLang: FALLBACKS — zh-SG は zh-CN (簡体) に振られる", () => {
  assert.equal(withNavigator(["zh-SG"]).detectLang(), "zh-CN");
});

test("detectLang: FALLBACKS script tag — zh-Hans / zh-Hans-CN / zh-Hans-SG は zh-CN (第19回 C19-06)", () => {
  // Android Chinese / 一部 ChromeOS が navigator.languages に zh-Hans-CN を入れる経路の対応。
  assert.equal(withNavigator(["zh-Hans"]).detectLang(), "zh-CN");
  assert.equal(withNavigator(["zh-Hans-CN"]).detectLang(), "zh-CN");
  assert.equal(withNavigator(["zh-Hans-SG"]).detectLang(), "zh-CN");
});

test("detectLang: FALLBACKS script tag — zh-Hant / zh-Hant-TW / zh-Hant-HK / zh-Hant-MO は zh-TW (第19回 C19-06)", () => {
  assert.equal(withNavigator(["zh-Hant"]).detectLang(), "zh-TW");
  assert.equal(withNavigator(["zh-Hant-TW"]).detectLang(), "zh-TW");
  assert.equal(withNavigator(["zh-Hant-HK"]).detectLang(), "zh-TW");
  assert.equal(withNavigator(["zh-Hant-MO"]).detectLang(), "zh-TW");
});

test("detectLang: bare 'zh' (script/region 無し) は SUPPORTED に無いため 'ja' フォールバック", () => {
  // 中国語は地域別 (zh-CN / zh-TW) を SUPPORTED にしているので、bare "zh" は base 一致しない。
  // どちらに寄せるべきかブラウザだけでは判断不能 → 最終 ja フォールバックで safer default。
  assert.equal(withNavigator(["zh"]).detectLang(), "ja");
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

// ---- 第19回 C19-05 / C19-14: navigator 異常入力ガード ----

test("detectLang: navigator === null (typeof null === 'object' 経路) でも例外を投げず 'ja' を返す (C19-05)", () => {
  // typeof null === "object" は JS 仕様。 typeof navigator !== "undefined" を素通り、
  // その後 Array.isArray(null.languages) で TypeError になる経路を防ぐ。
  const core = loadCore();
  core.setNavigator(null);
  assert.equal(core.Util.detectLang(), "ja");
});

test("detectLang: navigator.languages が string (非配列) でも language 経路にフォールバックする (C19-14)", () => {
  // 古い IE 系 / 一部の polyfill が navigator.languages = "ja" を返すケース。
  // Array.isArray("ja") === false で配列分岐を取らず、navigator.language || "ja" 経路で評価される。
  const core = loadCore();
  core.setNavigator({ languages: "ja", language: "en" });
  // languages は string でも .length > 0 だが Array.isArray が false なので language 側を見る
  assert.equal(core.Util.detectLang(), "en");
});

test("detectLang: navigator.languages が null でも language 経路にフォールバックする (C19-14)", () => {
  const core = loadCore();
  core.setNavigator({ languages: null, language: "vi" });
  assert.equal(core.Util.detectLang(), "vi");
});

test("detectLang: 大文字 SUPPORTED ('JA' / 'EN-US' / 'ZH-CN') は完全一致せず 'ja' フォールバック (C19-14)", () => {
  // ブラウザは小文字正規化された値を返すのが通例だが、polyfill / 手編集経路の防御。
  // FALLBACKS にも SUPPORTED にも大文字は無いため最終 ja フォールバック。
  assert.equal(withNavigator(["JA"]).detectLang(), "ja");
  assert.equal(withNavigator(["EN-US"]).detectLang(), "ja");
  assert.equal(withNavigator(["ZH-CN"]).detectLang(), "ja");
});

test("detectLang: 配列内重複 ['en','en','ja'] は先勝ちで 'en' を返す (C19-14)", () => {
  // 重複そのものはエラーにせず、先頭から走査して最初に見つかった SUPPORTED を返す動作を lock。
  assert.equal(withNavigator(["en", "en", "ja"]).detectLang(), "en");
});
